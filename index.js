const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ================= CONFIG =================

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = "1807488416";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ================= MEMORY BUFFER =================
// stores first message temporarily
let buffer = "";

// ================= HEALTH =================

app.get("/", (req, res) => {
  res.send("CIMA GPT Bot running (2-message mode)");
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
    let userText = cleanText(req.body.text);

    if (!userText) {
      return res.status(400).json({ error: "Missing text" });
    }

    console.log("Incoming:", userText);

    // ================= STEP 1: STORE FIRST MESSAGE =================

    if (!buffer) {
      buffer = userText;

      console.log("Stored first message, waiting for second...");

      await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
          chat_id: TELEGRAM_CHAT_ID,
          text: "📌 First input received. Please send the second (exhibit / extra information)."
        }
      );

      return res.json({ status: "waiting_for_second_message" });
    }

    // ================= STEP 2: COMBINE =================

    const combinedInput = `
QUESTION:
${buffer}

SUPPLEMENTARY INFO:
${userText}
`;

    // clear buffer
    buffer = "";

    console.log("Sending combined input to GPT...");

    // ================= GPT (DEEP SCS PROMPT) =================

    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a CIMA Strategic Case Study (SCS) top examiner.

You MUST produce a HIGH-DEGREE answer.

Requirements:
- Deep analysis (not surface level)
- Strong application to case facts
- Use financial + strategic reasoning
- Explicit evaluation of pros/cons
- Professional examiner tone

STRUCTURE:
1. Executive Summary (1–2 lines)
2. Analysis of Issues
3. Application to Case Material
4. Evaluation (balanced arguments)
5. Final Recommendation (clear judgement)

Maximise exam marks. Be precise, not verbose.
            `
          },
          {
            role: "user",
            content: combinedInput
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

    // ================= TELEGRAM SEND =================

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

    return res.json({ ok: true });

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);

    return res.status(500).json({ error: "server error" });
  }
});

// ================= START =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
