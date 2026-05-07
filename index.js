const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ================= CONFIG =================

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = "1807488416"; // fixed chat
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ================= HEALTH =================

app.get("/", (req, res) => {
  res.send("CIMA GPT Bot is running");
});

// ================= CLEANING =================

function cleanText(text) {
  if (!text) return "";

  return text
    .replace(/\n{2,}/g, "\n")
    .replace(/PDF/gi, "")
    .replace(/Google Translate/gi, "")
    .replace(/Q Search/gi, "")
    .replace(/\b[A-Z]\b/g, "")
    .trim();
}

// ================= SPLIT FUNCTION =================

function splitMessage(text, maxLength = 3500) {
  const parts = [];
  let current = "";

  const lines = text.split("\n");

  for (const line of lines) {
    if ((current + line).length > maxLength) {
      parts.push(current);
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  }

  if (current) parts.push(current);

  return parts;
}

// ================= WEBHOOK =================

app.post("/webhook", async (req, res) => {
  try {
    console.log("Raw input:", req.body);

    let userText = req.body.text;

    if (!userText) {
      return res.status(400).json({ error: "Missing text" });
    }

    // CLEAN INPUT
    userText = cleanText(userText);

    console.log("Cleaned input:", userText);

    // ================= GPT CALL =================

    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a CIMA Strategic Case Study (SCS) examiner.

Write structured answers:
1. Heading
2. Analysis
3. Application to case
4. Evaluation / Conclusion

Be concise but high quality.
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

    // ================= TELEGRAM SPLIT SEND =================

    const parts = splitMessage(answer);

    for (const part of parts) {
      await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
          chat_id: TELEGRAM_CHAT_ID,
          text: part
        }
      );
    }

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
