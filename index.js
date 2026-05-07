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

// ==================== REFERENCE ====================

const REFERENCE = `
KWIRTMAK CASE SUMMARY:
- Innovation-driven manufacturing
- Declining revenue and profit
- High debt and falling cash
- Strong competitor pressure
- Opportunities: medical 3D printing
`;

// ==================== HELPERS ====================

function splitMessage(text, size = 4000) {
  const parts = [];
  for (let i = 0; i < text.length; i += size) {
    parts.push(text.substring(i, i + size));
  }
  return parts;
}

// ==================== HEALTH CHECK ====================

app.get("/", (req, res) => {
  res.send("Bot is running");
});

// ==================== WEBHOOK ====================

app.post("/webhook", async (req, res) => {
  try {
    console.log("Update received");

    const update = req.body;

    // Accept different Telegram update types safely
    const message = update.message || update.edited_message;

    if (!message || !message.text) {
      console.log("No text message");
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;
    const userText = message.text;

    console.log("Chat ID:", chatId);
    console.log("User:", userText);

    // ==================== CHAT HISTORY ====================

    let history = await redis.get(`chat_${chatId}`);
    let messages = history ? JSON.parse(history) : [];

    messages.push({ role: "user", content: userText });
    messages = messages.slice(-10);

    // ==================== OPENAI ====================

    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a CIMA exam assistant.

Follow strict exam structure:
1. Heading
2. Explanation
3. Application to case
4. Evaluation

Use the reference:
${REFERENCE}
            `
          },
          ...messages
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

    console.log("GPT response generated");

    // ==================== SAVE HISTORY ====================

    messages.push({ role: "assistant", content: answer });

    await redis.set(`chat_${chatId}`, JSON.stringify(messages));

    // ==================== SEND TO TELEGRAM ====================

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

    console.log("Reply sent");

    return res.sendStatus(200);

  } catch (err) {
    console.error("Webhook error:", err.response?.data || err.message);

    // IMPORTANT: always return 200 so Telegram doesn't break webhook
    return res.sendStatus(200);
  }
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
