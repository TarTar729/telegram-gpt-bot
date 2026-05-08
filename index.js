const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "20mb" }));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const sessions = {};

function clean(text) {
  return text || "";
}

async function send(chatId, text) {
  await axios.post(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text
    }
  );
}

async function ask(prompt) {
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4.1-mini",
      temperature: 0.4,
      max_tokens: 2000,
      messages: [
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

app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.message;

    if (!msg || !msg.text) return res.sendStatus(200);

    const chatId = msg.chat.id;
    const text = clean(msg.text);

    if (!sessions[chatId]) sessions[chatId] = {};

    if (!sessions[chatId].first) {
      sessions[chatId].first = text;

      await send(chatId, "Send second message.");
      return res.sendStatus(200);
    }

    const first = sessions[chatId].first;
    sessions[chatId].first = null;

    const prompt = `Q: ${first}\n\nEXHIBIT: ${text}`;

    await send(chatId, "Thinking...");

    const answer = await ask(prompt);

    await send(chatId, answer);

    return res.sendStatus(200);

  } catch (e) {
    console.log(e.message);
    return res.sendStatus(200);
  }
});

app.get("/", (req, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on", PORT));
