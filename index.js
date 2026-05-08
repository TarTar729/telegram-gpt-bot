const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json({ limit: "20mb" }));

// ================= ENV =================

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!TELEGRAM_TOKEN || !OPENAI_API_KEY) {
  throw new Error("Missing env variables");
}

// ================= MEMORY =================

const sessions = {};

// ================= CLEAN =================

function cleanText(text = "") {
  return text.trim();
}

// ================= TELEGRAM =================

async function sendMessage(chatId, text) {
  await axios.post(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text: text
    }
  );
}

// ================= OPENAI =================

async function askAI(prompt) {
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4.1-mini",
      temperature: 0.4,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: "You are a CIMA exam expert. Be detailed and analytical."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`
      }
    }
  );

  return res.data.choices[0].message.content;
}

// ================= WEBHOOK =================

app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.message;

    if (!message || !message.text) {
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;
    const text = cleanText(message.text);

    if (!sessions[chatId]) {
      sessions[chatId] = { first: null };
    }

    // FIRST MESSAGE
    if (!sessions[chatId].first) {
      sessions[chatId].first = text;

      await sendMessage(
        chatId,
        "📥 First message received. Send second message."
      );

      return res.sendStatus(200);
    }

    // SECOND MESSAGE
    const first = sessions[chatId].first;
    sessions[chatId].first = null;

    const combined = `
QUESTION:
${first}

EXHIBIT:
${text}
`;

    await sendMessage(chatId, "🧠 Generating answer...");

    const answer = await askAI(combined);

    await sendMessage(chatId, answer);

    return res.sendStatus(200);

  } catch (err) {
    console.error(err.message);
    return res.sendStatus(200);
  }
});

// ================= HEALTH =================

app.get("/", (req, res) => {
  res.send("Bot running");
});

// ================= START =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
