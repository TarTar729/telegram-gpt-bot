const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "10mb" }));

// ================= ENV VARIABLES =================

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// YOUR TELEGRAM CHAT ID
const TELEGRAM_CHAT_ID = "1807488416";

// ================= MESSAGE BUFFER =================
// waits until 2 messages arrive

let firstMessage = null;

// ================= PRE-SEEN MEMORY =================

const PRESEEN = `
COMPANY OVERVIEW
Kwirtmak was founded in 1992 and listed on the Ennland stock exchange in 2004.

Kwirtmak manufactures advanced industrial 3D printers and additive manufacturing systems.

Its products include:
- extrusion printers
- stereolithography (SL)
- digital light processing (DLP)
- laser melting
- material jetting printers

Kwirtmak specialises in commercial-grade printers capable of producing plastic, metal and ceramic components.

The company also sells compatible materials for use in its printers.

INDUSTRIES SERVED
- Aerospace
- Automotive
- Consumer electronics
- Jewellery

KEY CUSTOMER NEEDS
- Cost
- Speed
- Accuracy
- Surface finish
- Strength
- Size capability

COMPETITIVE POSITION
Kwirtmak competes globally.
Breskko is its closest competitor and is currently outperforming Kwirtmak financially.

MISSION
Transform customers through innovation in design and production.

VISION
To become the leading provider of additive manufacturing solutions in a sustainable manner.

VALUES
- Customer-focused innovation
- Reliability
- Teamwork
- Wealth creation
- Trust in staff

BOARD & GOVERNANCE
Strong governance structure with:
- Audit Committee
- Risk & CSR Committee
- Remuneration Committee
- Nomination Committee

KEY PEOPLE
- Dr David Wallace (CEO): engineering and R&D background
- Agata Paluch (CFO): finance and accounting specialist
- Kristina Eder (Operations Director): quality and operations
- Said Abouchdak (CTO): technical and R&D expertise
- Ouyang Qi (Marketing Director): B2B sales expertise

KEY RISKS
- Economic volatility
- Demand fluctuations
- Inventory risk
- Product complexity
- Software and hardware failures
- Supplier dependence
- Legal and compliance exposure
- Health & safety risk
- Environmental regulation risk

FINANCIAL POSITION
2026 revenue fell from E$2.86bn to E$2.32bn.
Profit fell significantly.
Bank balances declined.
Borrowings remain high at E$1.35bn.
Research spending remains significant.

STRENGTHS
- Strong technical expertise
- Premium product quality
- Strong sustainability positioning
- Global customer base
- Advanced R&D capability

WEAKNESSES
- Declining revenue
- Falling profitability
- High debt
- Competitive pressure from Breskko
- Exposure to volatile industrial demand

SUSTAINABILITY
Benefits of 3D printing:
- lower material waste
- recycling potential
- reduced transport emissions

Kwirtmak actively monitors environmental performance and sustainability metrics.

MARKET OPPORTUNITIES
- Medical 3D printing
- Carbon fibre applications
- Aerospace growth
- Bespoke manufacturing
- Rapid prototyping demand

MEDICAL INDUSTRY
Medical use of 3D printing is increasing rapidly:
- dental implants
- artificial limbs
- surgical guides
- patient-specific models
- customised medical devices

Medical applications require:
- precision
- reliability
- compliance
- sterile manufacturing conditions

GENERAL EXAM THEMES
- Innovation strategy
- Investment appraisal
- Risk management
- Governance
- Sustainability
- Competitive strategy
- Operational performance
- Financing risk
- Stakeholder management
- KPI development
`;

// ================= CLEAN INPUT =================

function cleanText(text) {
  if (!text) return "";

  return text
    .replace(/Google Translate/gi, "")
    .replace(/Q Search/gi, "")
    .replace(/PDF/gi, "")
    .replace(/KAPLAN PUBLISHING/gi, "")
    .replace(/Strategic Case Study Exam/gi, "")
    .replace(/No reproduction without prior consent/gi, "")
    .replace(/\b[A-Z]\b/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ================= SPLIT LONG TELEGRAM MESSAGES =================

function splitMessage(text, maxLength = 3500) {
  const parts = [];

  while (text.length > maxLength) {
    parts.push(text.slice(0, maxLength));
    text = text.slice(maxLength);
  }

  parts.push(text);

  return parts;
}

// ================= HEALTH CHECK =================

app.get("/", (req, res) => {
  res.send("CIMA SCS Bot running");
});

// ================= MAIN WEBHOOK =================

app.post("/webhook", async (req, res) => {
  try {
    console.log("Raw input:", req.body);

    const incomingText = cleanText(req.body.text);

    console.log("Cleaned input:", incomingText);

    if (!incomingText) {
      return res.status(400).json({
        error: "No text received"
      });
    }

    // ================= FIRST MESSAGE =================

    if (!firstMessage) {
      firstMessage = incomingText;

      console.log("First message stored");

      await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
          chat_id: TELEGRAM_CHAT_ID,
          text:
            "📥 First input received.\n\nPlease send the second message (additional exhibit / reference material)."
        }
      );

      return res.json({
        status: "waiting_for_second_message"
      });
    }

    // ================= SECOND MESSAGE =================

    const combinedInput = `
MAIN TASK / QUESTION:
${firstMessage}

SUPPORTING EXHIBIT / INFORMATION:
${incomingText}
`;

    // clear buffer
    firstMessage = null;

    console.log("Sending combined input to GPT");

    // ================= OPENAI =================

    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content: `
You are a TOP-LEVEL CIMA Strategic Case Study examiner.

Use the following pre-seen knowledge constantly:

${PRESEEN}

REQUIREMENTS:
- Produce a high-mark SCS answer
- Use deep commercial reasoning
- Apply ALL points specifically to Kwirtmak
- Integrate strategic, financial, operational and governance analysis
- Avoid generic textbook theory
- Prioritise evaluation and judgement
- Discuss stakeholder impact
- Refer to risks and financial implications where relevant
- Compare with Breskko where useful
- Show professional scepticism

WRITING STYLE:
- Professional executive tone
- Dense analytical content
- Examiner-quality depth
- Clear business logic

STRUCTURE:
1. Executive Summary
2. Main Analysis
3. Advantages / Opportunities
4. Risks / Disadvantages
5. Strategic Evaluation
6. Recommendation / Conclusion

IMPORTANT:
Always behave like a real SCS top-scoring candidate.
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

    console.log("GPT response generated");

    // ================= SEND TO TELEGRAM =================

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

    return res.json({
      success: true
    });

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

// ================= START SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
