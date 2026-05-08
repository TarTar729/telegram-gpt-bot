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

// ================= PRE-SEEN =================

const PRESEEN = `
Kwirtmak is a global manufacturer of industrial 3D printing systems.

Key points:
- Strong R&D capability
- High debt (E$1.35bn)
- Declining revenue (E$2.86bn → E$2.32bn)
- Competitor: Breskko (stronger financially)

Medical opportunity:
- E$10bn market potential
- Requires sterile dedicated facility
- High regulatory complexity
- High entry cost (E$2bn)
`;

// ================= MEMORY =================

const sessions = {};

// ================= CLEAN TEXT =================

function cleanText(text = "") {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

// ================= SPLIT MESSAGE =================

function splitMessage(text, max = 3500) {
  const parts = [];
  while (text.length > max) {
    parts.push(text.slice(0, max));
    text = text.slice(max);
  }
  parts.push(text);
  return parts;
}

// ================= TELEGRAM SEND =================

async function sendMessage(chatId, text) {
  const parts = splitMessage(text);

  for (const part of parts) {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: part
      }
    );
  }
}

// ================= OPENAI =================

async function askOpenAI(prompt) {
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4.1-mini",
      temperature: 0.4,
      max_tokens: 2500,
      messages: [
        {
          role: "system",
          content: `
You are a CIMA Strategic Case Study expert.

Write:
- deep commercial analysis
- clear structure
- applied to Kwirtmak
- financial + strategic + operational reasoning
- no generic theory
`
        },
        {
          role: "user",
          content: prompt
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

  return res.data.choices[0].message.content;
}

// ================= WEBHOOK =================

app.post("/webhook", async (req, res) => {
  try {
    console.log("Webhook received");

    const message = req.body.message;

    if (!message || !message.text) {
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;
    const text = cleanText(message.text);

    console.log("User message:", text);

    // INIT SESSION
    if (!sessions[chatId]) {
      sessions[chatId] = {
        first: null
      };
    }

    // ================= FIRST MESSAGE =================

    if (!sessions[chatId].first) {
      sessions[chatId].first = text;

      await sendMessage(
        chatId,
        "📥 First message received. Please send second message."
      );

      return res.sendStatus(200);
    }

    // ================= SECOND MESSAGE =================

    const first = sessions[chatId].first;

    sessions[chatId].first = null;

    const combined = `
QUESTION:
${first}

EXHIBIT:
${text}
`;

    await sendMessage(chatId, "🧠 Generating answer...");

    console.log("Calling OpenAI...");

    const answer = await askOpenAI(combined);

    console.log("OpenAI done");

    await sendMessage(chatId, answer);

    return res.sendStatus(200);

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);

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
