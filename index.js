limit: "20mb" }));

// ================= CONFIG =================

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!TELEGRAM_TOKEN || !OPENAI_API_KEY) {
  throw new Error("Missing environment variables");
}

// ================= PRE-SEEN =================

const PRESEEN = `
Kwirtmak is a global manufacturer of industrial 3D printing systems.

Key facts:
- Declining revenue and profitability
- High debt (E$1.35bn)
- Strong R&D capability
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

// ================= TELEGRAM SENDER =================

async function sendTelegram(chatId, text) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: text
      }
    );
  } catch (err) {
    console.error("Telegram send error:", err.response?.data || err.message);
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
- applied to Kwirtmak
- financial + operational + strategic reasoning
- examiner-level structure
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
    console.log("Incoming request");

    const update = req.body;

    // ❗ BLOCK NON-TELEGRAM REQUESTS
    if (!update || !update.message) {
      console.log("Ignored non-Telegram request");
      return res.sendStatus(200);
    }

    const message =
      update.message ||
      update.edited_message ||
      update.channel_post;

    if (!message || !message.text) {
      console.log("No valid text message");
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;
    const text = cleanText(message.text);

    console.log("User message:", text);

    // ================= SESSION =================

    if (!sessions[chatId]) {
      sessions[chatId] = { first: null };
    }

    // ================= FIRST MESSAGE =================

    if (!sessions[chatId].first) {
      sessions[chatId].first = text;

      await sendTelegram(
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

    await sendTelegram(chatId, "🧠 Generating answer...");

    console.log("Calling OpenAI...");

    const answer = await askOpenAI(combined);

    console.log("OpenAI response received");

    await sendTelegram(chatId, answer);

    console.log("Response sent to Telegram");

    return res.sendStatus(200);

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
    return res.sendStatus(200);
  }
});

// ================= HEALTH CHECK =================

app.get("/", (req, res) => {
  res.send("Bot is running");
});

// ================= START SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
