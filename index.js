require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json({ limit: "20mb" }));

// ======================================================
// ENV
// ======================================================

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!TELEGRAM_TOKEN || !OPENAI_API_KEY) {
  throw new Error("Missing TELEGRAM_TOKEN or OPENAI_API_KEY");
}

// ======================================================
// TELEGRAM
// ======================================================

const TELEGRAM_CHAT_ID = "1807488416";

// ======================================================
// PRE-SEEN
// ======================================================

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
`;

// ======================================================
// MEMORY BUFFER
// ======================================================

const sessions = {};

// ======================================================
// UTILITIES
// ======================================================

function cleanText(text = "") {
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

function splitMessage(text, maxLength = 3500) {
  const chunks = [];

  while (text.length > maxLength) {
    let splitIndex = text.lastIndexOf("\n", maxLength);

    if (splitIndex === -1) {
      splitIndex = maxLength;
    }

    chunks.push(text.slice(0, splitIndex));
    text = text.slice(splitIndex);
  }

  chunks.push(text);

  return chunks;
}

async function sendTelegramMessage(text) {
  const parts = splitMessage(text);

  for (const part of parts) {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: part,
        parse_mode: "Markdown"
      }
    );
  }
}

// ======================================================
// OPENAI CALL
// ======================================================

async function generateSCSAnswer(combinedInput) {
  // ==================================================
  // STAGE 1 — STRATEGIC ANALYSIS
  // ==================================================

  const analysisResponse = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4.1",
      temperature: 0.3,
      max_tokens: 2500,
      messages: [
        {
          role: "system",
          content: `
You are an elite CIMA Strategic Case Study analyst.

PRE-SEEN:
${PRESEEN}

Your task is ONLY to identify:
- key strategic issues
- hidden commercial risks
- stakeholder concerns
- financial implications
- operational implications
- governance implications
- implementation barriers
- strategic opportunities

RULES:
- Apply everything specifically to Kwirtmak
- Prioritise commercial reasoning
- Avoid generic theory
- Show professional scepticism
- Think like a board adviser
- Do NOT write the final answer yet
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

  const strategicAnalysis =
    analysisResponse.data.choices[0].message.content;

  // ==================================================
  // STAGE 2 — FULL SCS ANSWER
  // ==================================================

  const finalResponse = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4.1",
      temperature: 0.4,
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content: `
You are producing a TOP-BAND CIMA Strategic Case Study answer.

PRE-SEEN:
${PRESEEN}

MANDATORY REQUIREMENTS:

1. Every point must be applied specifically to Kwirtmak.

2. Integrate:
- strategy
- finance
- governance
- operations
- sustainability
- stakeholder management
- risk management

3. Every major paragraph must include:
- analysis
- evaluation
- commercial reasoning
- implications
- judgement

4. Continuously discuss:
- financial consequences
- operational impact
- governance impact
- strategic fit
- stakeholder reactions
- execution risk

5. Demonstrate professional scepticism.

6. Compare with Breskko where strategically useful.

7. Avoid generic textbook discussion.

8. Prioritise depth over brevity.

9. Write like a top-scoring SCS candidate.

REQUIRED STRUCTURE:

# Executive Summary

# Strategic Issues Identified

# Detailed Strategic Analysis

## Financial Implications

## Operational Implications

## Governance and Risk Implications

## Stakeholder Impact

# Strategic Options

# Evaluation of Options

# Recommended Course of Action

# Implementation Risks and Mitigation

# Final Conclusion
`
        },
        {
          role: "assistant",
          content: strategicAnalysis
        },
        {
          role: "user",
          content: `
Using the analysis above, now produce the final examiner-quality SCS answer.

QUESTION + EXHIBITS:
${combinedInput}
`
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

  return finalResponse.data.choices[0].message.content;
}

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {
  res.send("Elite CIMA SCS Bot Running");
});

// ======================================================
// WEBHOOK
// ======================================================

app.post("/webhook", async (req, res) => {
  try {
    console.log("Incoming webhook:", req.body);

    const incomingText = cleanText(req.body.text || "");

    if (!incomingText) {
      return res.status(400).json({
        error: "No text received"
      });
    }

    // ==============================================
    // SESSION INITIALISATION
    // ==============================================

    const userId = TELEGRAM_CHAT_ID;

    if (!sessions[userId]) {
      sessions[userId] = {
        firstMessage: null
      };
    }

    // ==============================================
    // FIRST MESSAGE
    // ==============================================

    if (!sessions[userId].firstMessage) {
      sessions[userId].firstMessage = incomingText;

      await sendTelegramMessage(`
📥 *First exhibit/question received.*

Please now send:
- additional exhibit
- appendices
- scenario information
- supporting material
`);

      return res.json({
        status: "waiting_for_second_message"
      });
    }

    // ==============================================
    // SECOND MESSAGE
    // ==============================================

    const firstInput = sessions[userId].firstMessage;

    const combinedInput = `
MAIN REQUIREMENT / QUESTION:
${firstInput}

ADDITIONAL EXHIBIT / SUPPORTING MATERIAL:
${incomingText}
`;

    // clear memory
    sessions[userId].firstMessage = null;

    // ==============================================
    // SEND STATUS UPDATE
    // ==============================================

    await sendTelegramMessage(`
🧠 Generating examiner-quality strategic analysis...

This may take 20-40 seconds.
`);

    // ==============================================
    // GENERATE RESPONSE
    // ==============================================

    const answer = await generateSCSAnswer(combinedInput);

    // ==============================================
    // SEND TO TELEGRAM
    // ==============================================

    await sendTelegramMessage(answer);

    return res.json({
      success: true
    });

  } catch (err) {
    console.error(
      "SERVER ERROR:",
      err.response?.data || err.message
    );

    try {
      await sendTelegramMessage(`
❌ Error generating SCS response.

Please try again.
`);
    } catch (telegramError) {
      console.error("Telegram send failed");
    }

    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

// ======================================================
// START SERVER
// ======================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
