const express = require("express");
const axios = require("axios");
const { createClient } = require("redis");

const app = express();

app.use(express.json());

// ==================== ENV VARIABLES ====================

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

redis.on("error", err => {
  console.error("Redis Error:", err);
});

(async () => {
  await redis.connect();
  console.log("Redis connected");
})();

// ==================== REFERENCE ====================

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

// ==================== TELEGRAM WEBHOOK ====================

app.post("/webhook", async (req, res) => {
  try {
    console.log("Incoming update received");

    const message = req.body.message;

    // Ignore non-text messages
    if (!message || !message.text) {
      console.log("No text message found");
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;
    const userText = message.text;

    console.log("Chat ID:", chatId);
    console.log("User message:", userText);

    // ==================== LOAD CHAT HISTORY ====================

    let history = await redis.get(`chat_${chatId}`);
    let messages = history ? JSON.parse(history) : [];

    // Add latest user message
    messages.push({
      role: "user",
      content: userText
    });

    // Keep only last 10 messages
    messages = messages.slice(-10);

    // ==================== OPENAI REQUEST ====================

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

Use the reference material below when relevant, but do NOT rely only on it.
Combine it with your general knowledge.

Write like a CIMA examiner expects.

Reference:
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

    console.log("GPT answer generated");

    // ==================== SAVE CHAT HISTORY ====================

    messages.push({
      role: "assistant",
      content: answer
    });

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

    console.log("Reply sent successfully");

    res.sendStatus(200);

  } catch (err) {
    console.error("ERROR:");
    console.error(err.response?.data || err.message);

    res.sendStatus(500);
  }
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
