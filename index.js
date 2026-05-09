const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json({ limit: "20mb" }));

// ================= ENV =================

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// YOUR TELEGRAM CHAT ID
const TELEGRAM_CHAT_ID = "1807488416";

// ================= MEMORY =================

let firstMessage = null;

// ================= CLEAN =================

function cleanText(text = "") {
  return text
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ================= TELEGRAM SEND =================

async function sendMessage(text) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text
      }
    );
  } catch (err) {
    console.log("Telegram error:", err.response?.data || err.message);
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
You are a top-performing CIMA Strategic Case Study candidate.

Requirements:
- deep analysis
- commercial judgement
- strategic evaluation
- financial implications
- stakeholder analysis
- risks and opportunities
- specific application to Kwirtmak
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
    console.log("📩 Incoming request:");
    console.log(JSON.stringify(req.body, null, 2));

    const text = req.body.text;

    if (!text) {
      console.log("❌ No text found");
      return res.sendStatus(200);
    }

    const cleanedText = cleanText(text);

    console.log("💬 Text received");

    // ================= FIRST MESSAGE =================

    if (!firstMessage) {
      firstMessage = cleanedText;

      await sendMessage(
        "📥 First message received. Please send second message."
      );

      return res.sendStatus(200);
    }

    // ================= SECOND MESSAGE =================

    const prompt = `
QUESTION:
${firstMessage}

EXHIBIT:
${cleanedText}
`;

    firstMessage = null;

    await sendMessage("🧠 Generating answer...");

    console.log("🤖 Calling OpenAI...");

    const answer = await askOpenAI(prompt);

    console.log("✅ OpenAI response received");

    // Telegram message size protection
    const chunks = [];

    for (let i = 0; i < answer.length; i += 3500) {
      chunks.push(answer.slice(i, i + 3500));
    }

    for (const chunk of chunks) {
      await sendMessage(chunk);
    }

    console.log("📤 Answer sent");

    return res.sendStatus(200);

  } catch (err) {
    console.log("❌ ERROR:", err.response?.data || err.message);
    return res.sendStatus(200);
  }
});

// ================= HEALTH =================

app.get("/", (req, res) => {
  res.send("Bot is running");
});

// ================= START =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
