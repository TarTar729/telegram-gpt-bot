const express = require("express");
const axios = require("axios");
const { createClient } = require("redis");

const app = express();
app.use(express.json());

// ENV VARIABLES (set in Render)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REDIS_URL = process.env.REDIS_URL;

// TELEGRAM USERS
const USERS = [
  1807488416,
  8091257985
];

// 🔹 REDIS SETUP
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

- Innovation-driven, customer-focused manufacturing
- Declining revenue and profit
- Strong competitor (Breskko outperforming)
- High debt, falling cash
- Strong R&D and sustainability positioning
- Risks: demand volatility, supply chain, compliance
- Opportunities: medical 3D printing, carbon fibre
`;

// 🔹 HEALTH CHECK
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
    // 🔹 GET HISTORY
    let history = await redis.get("chat_history");
    let messages = history ? JSON.parse(history) : [];

    // ADD USER MESSAGE
    messages.push({ role: "user", content: userText });

    // LIMIT HISTORY
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
You are a CIMA exam assistant.

Your answers MUST follow CIMA marking criteria:

- Always apply points to Kwirtmak
- Avoid generic theory
- Be concise and structured
- Maximise marks per sentence

Structure:

1. Heading
2. Explanation
3. Application to Kwirtmak
4. Impact / Evaluation

Adapt to command words:
- Evaluate → pros, cons, judgement
- Recommend → decision + justification
- Analyse → causes
- Discuss → balanced view

Avoid long paragraphs and repetition.

Write like a CIMA examiner expects.

Reference:
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

    // SAVE HISTORY
    messages.push({ role: "assistant", content: answer });
    await redis.set("chat_history", JSON.stringify(messages));

    // 🔹 SEND TO TELEGRAM
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

// 🔹 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
