const express = require("express");
const axios = require("axios");
const { createClient } = require("redis");

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REDIS_URL = process.env.REDIS_URL;

const USERS = [1807488416, 8091257985];

// 🔹 Redis
const redis = createClient({
  url: REDIS_URL,
  socket: {
    tls: true,
    rejectUnauthorized: false
  }
});

redis.on("error", (err) => console.error("Redis error:", err));
redis.connect().then(() => console.log("Redis connected"));

// 🔹 CIMA REFERENCE (compressed)
const REFERENCE = `
Kwirtmak case: declining revenue, strong competitor (Breskko),
high debt, innovation strength, sustainability advantage,
growth opportunities in medical + carbon fibre.
`;

// 🔹 HOME
app.get("/", (req, res) => {
  res.send("Bot is running");
});

// 🔹 HELP FUNCTION
function splitMessage(text, max = 4000) {
  const parts = [];
  for (let i = 0; i < text.length; i += max) {
    parts.push(text.slice(i, i + max));
  }
  return parts;
}

// 🔹 WEBHOOK
app.post("/webhook", async (req, res) => {
  const userText = req.body.text;
  const userId = req.body.userId || "default";

  console.log("Received:", userText);

  if (!userText) return res.sendStatus(400);

  try {
    // 🔹 LOAD PENDING CONTEXT
    let pending = await redis.get(`pending:${userId}`);
    pending = pending ? JSON.parse(pending) : [];

    // 🔹 ADD NEW INPUT (image OCR text)
    pending.push(userText);

    console.log("Pending items:", pending.length);

    // 🔥 WAIT FOR 2 INPUTS BEFORE ANSWERING
    if (pending.length < 2) {
      await redis.set(`pending:${userId}`, JSON.stringify(pending));
      return res.json({
        status: "waiting",
        message: "Image stored, waiting for next input..."
      });
    }

    // 🔹 COMBINE CONTEXT
    const combined = pending.join("\n\n");

    // CLEAR MEMORY
    await redis.del(`pending:${userId}`);

    // 🔹 CALL GPT
    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a CIMA exam assistant.

Always:
- Apply answers to Kwirtmak
- Use structured exam format
- Be concise and analytical

Reference:
${REFERENCE}
            `
          },
          {
            role: "user",
            content: combined
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const answer = aiRes.data.choices[0].message.content;

    console.log("GPT:", answer);

    // 🔹 SEND RESPONSE
    const parts = splitMessage(answer);

    for (const id of USERS) {
      for (const part of parts) {
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
          {
            chat_id: id,
            text: part
          }
        );
      }
    }

    res.sendStatus(200);

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// 🔹 START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
