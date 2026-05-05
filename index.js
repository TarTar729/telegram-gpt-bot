const express = require("express");
const axios = require("axios");
const { createClient } = require("redis");

const app = express();
app.use(express.json());

// ENV VARIABLES (Render)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REDIS_URL = process.env.REDIS_URL;

// TELEGRAM USERS
const USERS = [
  1807488416,
  8091257985
];

// REDIS CLIENT
const redis = createClient({
  url: REDIS_URL,
  socket: {
    tls: true,
    rejectUnauthorized: false
  }
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

redis.connect().then(() => {
  console.log("Redis connected");
});

// 🔹 KWIRTMAK REFERENCE (COMPRESSED)
const REFERENCE = `
KWIRTMAK CASE SUMMARY:

- Mission: Innovation-driven, customer-focused manufacturing
- Vision: Leader in sustainable additive manufacturing
- Values: Customer focus, reliability, teamwork, profit

- Governance: Strong board + Audit, Risk & CSR committees

- Key risks:
  Economic conditions, demand volatility, product complexity,
  supplier dependence, legal/compliance

- Financials:
  Revenue ↓, profit ↓, costs ↓
  Issues: high debt, falling cash, currency losses

- Position:
  Strong equity + assets, but weak cash and high borrowings

- Competitor (Breskko):
  Outperforming (revenue ↑, profit ↑)

- Sustainability:
  Less waste, lower emissions, energy efficiency

- Opportunities:
  Medical 3D printing, carbon fibre demand

- Core themes:
  Innovation, competition, declining revenue,
  high costs, sustainability, supply chain risk
`;

// HEALTH CHECK
app.get("/", (req, res) => {
  res.send("Bot is running");
});

// 🔹 SPLIT LONG TELEGRAM MESSAGES
function splitMessage(text, maxLength = 4000) {
  const parts = [];
  for (let i = 0; i < text.length; i += maxLength) {
    parts.push(text.slice(i, i + maxLength));
  }
  return parts;
}

// 🔹 MAIN WEBHOOK
app.post("/webhook", async (req, res) => {
  const userText = req.body.text;
  console.log("Received:", userText);

  if (!userText) {
    return res.status(400).json({ error: "No text provided" });
  }

  try {
    // 🔹 GET CHAT HISTORY FROM REDIS
    let history = await redis.get("chat_history");
    let messages = history ? JSON.parse(history) : [];

    // ADD USER MESSAGE
    messages.push({ role: "user", content: userText });

    // LIMIT HISTORY (last 10 messages)
    const trimmed = messages.slice(-10);

    // 🔹 OPENAI CALL
    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a helpful exam assistant.

Use the reference material below when relevant, but do NOT rely only on it.
Combine it with your general knowledge.

${REFERENCE}
            `
          },
          ...trimmed
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

    console.log("GPT answer:", answer);

    // SAVE UPDATED HISTORY
    messages.push({ role: "assistant", content: answer });
    await redis.set("chat_history", JSON.stringify(messages));

    // 🔹 SEND TO TELEGRAM (SPLIT IF TOO LONG)
    const parts = splitMessage(answer);

    for (const userId of USERS) {
      for (const part of parts) {
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
          {
            chat_id: userId,
            text: part
          }
        );
      }
    }

    res.sendStatus(200);

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
