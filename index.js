const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Environment variables (set in Render)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Replace with your real Telegram user IDs
const USERS = [
  1807488416,
  8091257985
];

// Health check
app.get("/", (req, res) => {
  res.send("Bot is running");
});

// Helper: split long messages (Telegram limit ~4096)
const MAX_LENGTH = 4000;

function splitMessage(text) {
  const parts = [];
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    parts.push(text.slice(i, i + MAX_LENGTH));
  }
  return parts;
}

// Main webhook
app.post("/webhook", async (req, res) => {
  const userText = req.body.text;
  console.log("Received from Shortcut:", userText);

  if (!userText) {
    return res.status(400).json({ error: "No text provided" });
  }

  try {
    // 🔹 Send to OpenAI
    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: userText }]
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

    // 🔹 Split long messages
    const messages = splitMessage(answer);

    // 🔹 Send to Telegram users
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

    // 🔹 Respond back to Shortcut
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
