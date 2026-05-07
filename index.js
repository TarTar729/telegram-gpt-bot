const express = require("express");
const axios = require("axios");

const app = express();

// ==================== HEALTH ====================

app.get("/", (req, res) => {
  res.send("Bot is running");
});

// ==================== MAIN SHORTCUT ENDPOINT ====================

app.get("/webhook", async (req, res) => {
  try {
    const userText = req.query.text;

    if (!userText) {
      return res.status(400).send("Missing ?text=");
    }

    console.log("Received:", userText);

    // ==================== OPENAI CALL ====================

    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a CIMA Strategic Case Study (SCS) examiner.

Write:
- Structured answer
- Headings
- Deep analysis
- Application to case
- Evaluation and judgement
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
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const answer = aiRes.data.choices[0].message.content;

    console.log("GPT done");

    // ==================== RETURN DIRECTLY TO SHORTCUT ====================

    res.json({
      answer: answer
    });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Error");
  }
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
