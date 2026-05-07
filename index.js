const express = require("express");
const axios = require("axios");
const { createClient } = require("redis");

const app = express();
app.use(express.json());

// ENV
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REDIS_URL = process.env.REDIS_URL;

// Users (optional for future Telegram expansion)
const USERS = ["me"];

// -------------------- REDIS --------------------
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

// -------------------- CIMA REFERENCE --------------------
const REFERENCE = `
Kwirtmak Case Summary:
- Innovation-driven manufacturing company
- Declining revenue and profit
- Strong competitor: Breskko outperforming
- High debt and pressure on cash flow
- Strong R&D and sustainability advantage
- Opportunities: medical 3D printing, carbon fibre
- Risks: competition, demand volatility, supply chain
`;

// -------------------- HELPERS --------------------
function splitMessage(text, max = 4000) {
  const parts = [];
  for (let i = 0; i < text.length; i += max) {
    parts.push(text.slice(i, i + max));
  }
  return parts;
}

// -------------------- HEALTH CHECK --------------------
app.get("/", (req, res) => {
  res.send("Bot is running");
});

// -------------------- WEBHOOK --------------------
app.post("/webhook", async (req, res) => {
  const userText = req.body.text;
  const userId = req.body.userId || "default";

  console.log("Received:", userText);

  if (!userText) return res.sendStatus(400);

  try {
    // -------------------- LOAD MEMORY --------------------
    let pending = await redis.get(`pending:${userId}`);
    pending = pending ? JSON.parse(pending) : [];

    // add new OCR/text input
    pending.push(userText);

    console.log(`Pending inputs: ${pending.length}`);

    // -------------------- WAIT FOR MULTIPLE INPUTS --------------------
    // (you can change 2 → 3 if you want more images per answer)
    if (pending.length < 2) {
      await redis.set(`pending:${userId}`, JSON.stringify(pending));

      return res.json({
        status: "waiting",
        message: "Input stored. Send next image/question."
      });
    }

    // -------------------- COMBINE INPUTS --------------------
    const combinedInput = pending.join("\n\n");

    // clear memory
    await redis.del(`pending:${userId}`);

    // -------------------- OPENAI REQUEST --------------------
    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a CIMA exam-grade strategic analyst.

Your goal is HIGH-DEPTH, high-mark answers.

RULES:

1. NEVER give shallow answers.
2. Every point MUST include:
   - Explanation
   - Application to Kwirtmak
   - Strategic impact (SO WHAT)

3. Always show reasoning chains:
   cause → effect → implication → judgement

4. Link ideas across:
   finance, competition, strategy, sustainability

5. Always include evaluation, not just description.

6. Think like an examiner awarding marks.

STRUCTURE:

- Clear headings
- Deep analytical paragraphs
- Final judgement or recommendation

REFERENCE:
${REFERENCE}
            `
          },
          {
            role: "user",
            content: combinedInput
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

    const answer = aiRes.data.choices[0].message.content;

    console.log("GPT answer generated");

    // -------------------- SEND TO TELEGRAM --------------------
    const parts = splitMessage(answer);

    for (const id of USERS) {
      for (const part of parts) {
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
          {
            chat_id: id,
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

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
