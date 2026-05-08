const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json({ limit: "20mb" }));

// ================= ENV =================

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!TELEGRAM_TOKEN || !OPENAI_API_KEY) {
  throw new Error("Missing TELEGRAM_TOKEN or OPENAI_API_KEY");
}

// ================= MEMORY =================

const sessions = {};

// ================= CLEAN TEXT =================

function cleanText(text = "") {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

// ================= TELEGRAM SEND =================

async function sendMessage(chatId, text) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
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
You are a CIMA Strategic Case Study expert.

Write:
- structured answer
- deep commercial analysis
- applied to Kwirtmak
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
    console.log("📩 Incoming request");
    console.log(JSON.stringify(req.body, null, 2));

    const update = req.body;

    // ================= FIX: HANDLE BOTH FORMATS =================

    const text =
      update.text ||
      update.message?.text ||
      update.edited_message?.text ||
      update.channel_post?.text;

    const chatId =
      update.chat?.id ||
      update.message?.chat?.id ||
      update.edited_message?.chat?.id;

    if (!text) {
      console.log("❌ No text found");
      return res.sendStatus(200);
    }

    if (!chatId) {
      console.log("❌ No chatId found");
      return res.sendStatus(200);
    }

    const cleanedText = cleanText(text);

    console.log("💬 User text:", cleanedText);

    // ================= SESSION =================

    if (!sessions[chatId]) {
      sessions[chatId] = { first: null };
    }

    // ================= FIRST MESSAGE =================

    if (!sessions[chatId].first) {
      sessions[chatId].first = cleanedText;

      await sendMessage(
        chatId,
        "📥 First message received. Now send second message."
      );

      return res.sendStatus(200);
    }

    // ================= SECOND MESSAGE =================

    const first = sessions[chatId].first;
    sessions[chatId].first = null;

    const combinedPrompt = `
QUESTION:
${first}

EXHIBIT:
${cleanedText}
`;

    await sendMessage(chatId, "🧠 Generating answer...");

    console.log("🤖 Calling OpenAI...");

    const answer = await askOpenAI(combinedPrompt);

    console.log("✅ OpenAI response received");

    await sendMessage(chatId, answer);

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
