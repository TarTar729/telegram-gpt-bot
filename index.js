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

// Connect to Redis
const redis = createClient({
  url: REDIS_URL
});

redis.connect().catch(console.error);

// Health check
app.get("/", (req, res) => {
  res.send("Bot is running");
});

// Telegram message limit
const MAX_LENGTH = 4000;

function splitMessage(text) {
  const parts = [];
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    parts.push(text.slice(i, i + MAX_LENGTH));
  }
  return parts;
}

// MAIN webhook
app.post("/webhook", async (req, res) => {
  const userText = req.body.text;
  console.log("Received from Shortcut:", userText);

  if (!userText) {
    return res.status(400).json({ error: "No text provided" });
  }

  try {
    // 👤 Use single user key (you can improve later)
    const userKey = "shortcut-user";

    // 🔹 Load history from Redis
    const historyRaw = await redis.lRange(userKey, 0, -1);
    const history = historyRaw.map(msg => JSON.parse(msg));

    // 🔹 Add new user message
    history.push({ role: "user", content: userText });

    // 🔹 Limit history (keep last 10 messages)
    const trimmedHistory = history.slice(-10);

    // 🔹 Send to OpenAI
    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: trimmedHistory
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

    // 🔹 Save conversation back to Redis
    await redis.del(userKey); // clear old
    for (const msg of trimmedHistory) {
      await redis.rPush(userKey, JSON.stringify(msg));
    }

    await redis.rPush(userKey, JSON.stringify({
      role: "assistant",
      content: answer
    }));

    // 🔹 Split long messages
    const messages = splitMessage(answer);

    // 🔹 Send to Telegram
    for (const userId of USERS) {
      for (let i = 0; i < messages.length; i++) {
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
          {
            chat_id: userId,
            text: `Part ${i + 1}/${messages.length}\n\n${messages[i]}`
          }
        );
      }
    }

    // 🔹 Respond to Shortcut
    return res.json({
      status: "ok",
      received: userText
    });

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
