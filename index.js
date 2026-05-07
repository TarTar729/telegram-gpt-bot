const express = require("express");
const axios = require("axios");
const { createClient } = require("redis");

const app = express();
app.use(express.json());

// ==================== ENV ====================

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REDIS_URL = process.env.REDIS_URL;

// ==================== REDIS ====================

const redis = createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: retries => Math.min(retries * 100, 3000)
  }
});

redis.on("error", err => console.error("Redis Error:", err));

(async () => {
  await redis.connect();
  console.log("Redis connected");
})();

// ==================== HEALTH ====================

app.get("/", (req, res) => {
  res.send("Bot is running");
});

// ==================== WEBHOOK ====================

app.post("/webhook", async (req, res) => {
  try {
    console.log("Update received");

    const message = req.body.message || req.body.edited_message;

    if (!message || !message.text) {
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;
    const userText = message.text;

    console.log("Chat:", chatId);
    console.log("Text:", userText);

    // ==================== STEP 1: STORE INPUTS ====================

    let temp = await redis.get(`temp_${chatId}`);
    temp = temp ? JSON.parse(temp) : [];

    temp.push(userText);

    console.log("Stored messages:", temp.length);

    // Wait until we have 2 messages
    if (temp.length < 2) {
      await redis.set(`temp_${chatId}`, JSON.stringify(temp));

      await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: "📥 Message received. Waiting for second input..."
        }
      );

      return res.sendStatus(200);
    }

    // ==================== STEP 2: COMBINE INPUT ====================

    const combinedInput = temp.join("\n\n");

    // clear temp storage
    await redis.del(`temp_${chatId}`);

    console.log("Sending combined input to GPT");

    // ==================== STEP 3: GPT REQUEST ====================

    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a CIMA Strategic Case Study (SCS) examiner.

You must:
- Write structured exam answers
- Use headings
- Apply analysis to the case
- Provide evaluation and judgement
- Be concise but deep

Structure:
1. Heading
2. Analysis
3. Application to case
4. Evaluation / Conclusion
            `
          },
          {
            role: "user",
            content: combinedInput
          }
        ],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const answer = aiRes.data.choices[0].message.content;

    console.log("GPT answer generated");

    // ==================== STEP 4: SEND RESPONSE ====================

    const parts = splitMessage(answer);

    for (const part of parts) {
      await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: part
        }
      );
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);

    // IMPORTANT: always return 200 so Telegram doesn't retry endlessly
    return res.sendStatus(200);
  }
});

// ==================== HELPERS ====================

function splitMessage(text, size = 4000) {
  const parts = [];
  for (let i = 0; i < text.length; i += size) {
    parts.push(text.substring(i, i + size));
  }
  return parts;
}

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
