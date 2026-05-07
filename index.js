const express = require("express");
const axios = require("axios");

const app = express();

// IMPORTANT: allows JSON body from iPhone Shortcut
app.use(express.json());

// ==================== HEALTH CHECK ====================

app.get("/", (req, res) => {
  res.send("GPT Shortcut Bot is running");
});

// ==================== MAIN ENDPOINT ====================
// Shortcut → POST JSON → GPT → response back

app.post("/webhook", async (req, res) => {
  try {
    console.log("Request received:", req.body);

    // Accept text from Shortcut
    const userText = req.body.text;

    if (!userText) {
      return res.status(400).json({
        error: "Missing 'text' in request body"
      });
    }

    console.log("User input:", userText);

    // ==================== OPENAI REQUEST ====================

    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a CIMA Strategic Case Study (SCS) examiner.

You MUST:
- Write structured answers
- Use headings
- Apply analysis to case material
- Provide evaluation and judgement
- Be concise but deep

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
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const answer = aiRes.data.choices[0].message.content;

    console.log("GPT response generated");

    // ==================== RETURN TO SHORTCUT ====================

    return res.json({
      answer: answer
    });

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: "Server error"
    });
  }
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
