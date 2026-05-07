const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ================= ENV =================

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ================= HEALTH CHECK =================

app.get("/", (req, res) => {
  res.send("GPT Shortcut → Telegram Bot is running");
});

// ================= INPUT CLEANING =================

function cleanText(text) {
  if (!text) return "";

  return text
    // remove excessive new lines
    .replace(/\n{2,}/g, "\n")
    // remove common OCR/PDF noise
    .replace(/Q\s*Search/gi, "")
    .replace(/PDF/gi, "")
    .replace(/Google Translate/gi, "")
    .replace(/KAPLAN PUBLISHING/gi, "")
    .replace(/\bPage\s*\d+\b/gi, "")
    // remove standalone single letters like "N"
    .replace(/\b[A-Z]\b/g, "")
    // trim
    .trim();
}

// ================= WEBHOOK =================

app.post("/webhook", async (req, res) => {
  try {
    console.log("Raw input:", req.body);

    let userText = req.body.text;

    if (!userText) {
      return res.status(400).json({ error: "Missing text" });
    }

    // 🔥 CLEAN INPUT FIRST
    userText = cleanText(userText);

    console.log("Cleaned input:", userText);

    // ================= GPT REQUEST =================

    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a CIMA Strategic Case Study (SCS) examiner.

You must:
- Write structured exam answers
- Use clear headings
- Apply analysis to the case
- Provide evaluation and judgement
- Be concise but high quality

Structure:
1. Heading
2. Analysis
3. Application to case
4. Evaluation / Conclusion
            `
          },
          {
            role: "user",
            content: userText
          }
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

    console.log("GPT response generated");

    // ================= SEND TO TELEGRAM =================

    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: answer,
        parse_mode: "Markdown"
      }
    );

    console.log("Sent to Telegram");

    return res.json({ ok: true });

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: "Server error"
    });
  }
});

// ================= START SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
