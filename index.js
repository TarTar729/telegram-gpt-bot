const express = require("express");
const axios = require("axios");
const { createClient } = require("redis");

const app = express();
app.use(express.json());

// ENV variables (set in Render)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REDIS_URL = process.env.REDIS_URL;

// Telegram users
const USERS = [
  1807488416,
  8091257985
];

// -------------------- REDIS --------------------
const redis = createClient({
  url: REDIS_URL,
  socket: {
    tls: true,
    rejectUnauthorized: false
  }
});

// Prevent crash on Redis errors
redis.on("error", (err) => {
  console.error("Redis error:", err);
});

// Connect safely
(async () => {
  try {
    await redis.connect();
    console.log("Redis connected");
  } catch (err) {
    console.error("Redis connection failed:", err);
  }
})();

// -------------------- ROUTES --------------------

// Health check
app.get("/", (req, res) => {
  res.send("Bot is running");
});

// Split long Telegram messages
const MAX_LENGTH = 4000;

function splitMessage(text) {
  const parts = [];
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    parts.push(text.slice(i, i + MAX_LENGTH));
  }
  return parts;
}

// -------------------- MAIN WEBHOOK --------------------
app.post("/webhook", async (req, res) => {
  const userText = req.body.text;

  console.log("Received from Shortcut:", userText);

  if (!userText) {
    return res.status(400).json({ error: "No text provided" });
  }

  try {
    const userKey = "shortcut-user";

    // Load memory
    const historyRaw = await redis.lRange(userKey, 0, -1);
    const history = historyRaw.map(msg => JSON.parse(msg));

    // Add new message
    history.push({ role: "user", content: userText });

    const trimmed = history.slice(-10);

    // OpenAI request
    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: trimmed
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const answer = aiRes.data.choices[0].message.content;
    console.log("GPT answer:", answer);

    // Save memory
    await redis.del(userKey);

    for (const msg of trimmed) {
      await redis.rPush(userKey, JSON.stringify(msg));
    }

    await redis.rPush(
      userKey,
      JSON.stringify({ role: "assistant", content: answer })
    );

    // Send to Telegram (split if needed)
    const messages = splitMessage(answer);

    for (const userId of USERS) {
      for (const part of messages) {
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
          {
            chat_id: userId,
            text: part
          }
        );
      }
    }

    return res.json({
      status: "ok",
      received: userText
    });

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
    return res.status(500).json({ error: "Server error" });
  }
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
