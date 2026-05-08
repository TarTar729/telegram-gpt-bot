const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json({ limit: "20mb" }));

// ======================================================
// ENVIRONMENT VARIABLES
// ======================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

if (!OPENAI_API_KEY || !TELEGRAM_TOKEN) {
  throw new Error(
    "Missing OPENAI_API_KEY or TELEGRAM_TOKEN environment variables"
  );
}

// ======================================================
// PRE-SEEN MATERIAL
// ======================================================

const PRESEEN = `
Kwirtmak is a global manufacturer of advanced industrial 3D printers and additive manufacturing systems.

Products:
- extrusion printers
- stereolithography (SL)
- DLP
- laser melting
- material jetting

Industries:
- aerospace
- automotive
- consumer electronics
- jewellery

Strengths:
- technical expertise
- premium quality
- advanced R&D
- sustainability positioning
- global customer base

Weaknesses:
- declining revenue
- falling profitability
- high debt
- competitive pressure from Breskko
- volatile industrial demand

Financial Position:
- revenue declined from E$2.86bn to E$2.32bn
- profitability declined significantly
- borrowings remain high at E$1.35bn
- cash balances declined
- R&D spending remains significant

Mission:
Transform customers through innovation in design and production.

Vision:
To become the leading provider of additive manufacturing solutions sustainably.

Medical sector opportunities include:
- dental implants
- artificial limbs
- surgical guides
- patient-specific models
- customised medical devices

Medical manufacturing requires:
- precision
- reliability
- regulatory compliance
- sterile conditions

Key Risks:
- supplier dependence
- product complexity
- hardware/software failure
- legal exposure
- environmental regulation
- operational risk
- demand volatility
`;

// ======================================================
// MEMORY STORE
// ======================================================

const sessions = {};

// ======================================================
// CLEAN INPUT
// ======================================================

function cleanText(text = "") {
  return text
    .replace(/Google Translate/gi, "")
    .replace(/KAPLAN PUBLISHING/gi, "")
    .replace(/PDF/gi, "")
    .replace(/No reproduction without prior consent/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ======================================================
// SPLIT TELEGRAM MESSAGE
// ======================================================

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

// ======================================================
// SEND TELEGRAM MESSAGE
// ======================================================

async function sendTelegramMessage(chatId, text) {
  const chunks = splitMessage(text);

  for (const chunk of chunks) {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: chunk,
        parse_mode: "Markdown"
      }
    );
  }
}

// ======================================================
// OPENAI REQUEST
// ======================================================

async function callOpenAI(messages, model, temperature, max_tokens) {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      temperature,
      max_tokens,
      messages
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.choices[0].message.content;
}

// ======================================================
// GENERATE ELITE SCS ANSWER
// ======================================================

async function generateSCSAnswer(questionInput) {

  // ==================================================
  // STAGE 1 — ISSUE IDENTIFICATION
  // ==================================================

  const issueMessages = [
    {
      role: "system",
      content: `
You are a senior CIMA Strategic Case Study examiner.

PRE-SEEN:
${PRESEEN}

TASK:
Identify the MOST IMPORTANT strategic issues arising from the scenario.

For EACH issue analyse:
- strategic significance
- financial implications
- operational implications
- stakeholder implications
- governance implications
- hidden risks
- execution concerns
- urgency

IMPORTANT:
- Apply everything specifically to Kwirtmak
- Prioritise commercial reasoning
- Challenge assumptions
- Avoid generic theory
- Think like a board adviser
- Do NOT write the final answer
`
    },
    {
      role: "user",
      content: questionInput
    }
  ];

  const identifiedIssues = await callOpenAI(
    issueMessages,
    "gpt-4.1-mini",
    0.2,
    1800
  );

  // ==================================================
  // STAGE 2 — DEEP STRATEGIC EXPANSION
  // ==================================================

  const expansionMessages = [
    {
      role: "system",
      content: `
You are preparing a strategic Board briefing paper.

PRE-SEEN:
${PRESEEN}

Expand the identified issues into deep commercial analysis.

For EACH issue explain:
- WHY it matters
- operational consequences
- financing implications
- implementation barriers
- governance concerns
- stakeholder reactions
- short-term implications
- long-term implications
- strategic trade-offs
- execution risk
- mitigation strategies
- competitive implications
- sustainability implications

IMPORTANT:
Do NOT stop analysis after identifying a point.

Fully explain:
- why the point matters
- what consequences arise
- how stakeholders are affected
- whether implementation is realistic
- whether financial returns justify the risk

Assume the Board will challenge weak arguments aggressively.

Avoid generic theory.
Prioritise evaluation and judgement.
`
    },
    {
      role: "assistant",
      content: identifiedIssues
    },
    {
      role: "user",
      content: `
Expand the strategic issues fully using the scenario.
`
    }
  ];

  const expandedAnalysis = await callOpenAI(
    expansionMessages,
    "gpt-4.1-mini",
    0.3,
    3000
  );

  // ==================================================
  // STAGE 3 — FINAL EXAMINER ANSWER
  // ==================================================

  const finalMessages = [
    {
      role: "system",
      content: `
You are writing a TOP-BAND CIMA Strategic Case Study answer.

PRE-SEEN:
${PRESEEN}

MANDATORY REQUIREMENTS:

- Write like a top 5% SCS candidate
- Produce board-level commercial reasoning
- Integrate strategy, finance, governance, operations and risk
- Apply ALL points specifically to Kwirtmak
- Prioritise judgement over description
- Demonstrate professional scepticism
- Discuss implementation realism
- Discuss financial consequences in depth
- Analyse stakeholder impact continuously
- Evaluate trade-offs thoroughly

IMPORTANT:
Every major paragraph must contain:
- analysis
- evaluation
- implications
- judgement
- strategic relevance

Do NOT produce generic textbook commentary.

STRUCTURE:

# Executive Summary

# Key Strategic Issues

# Strategic Evaluation

# Financial and Operational Implications

# Governance and Risk Considerations

# Stakeholder Impact

# Strategic Recommendation

# Implementation Priorities

# Conclusion
`
    },
    {
      role: "assistant",
      content: expandedAnalysis
    },
    {
      role: "user",
      content: `
Using the strategic analysis above, write the final examiner-quality SCS response.

QUESTION:
${questionInput}
`
    }
  ];

  const finalAnswer = await callOpenAI(
    finalMessages,
    "gpt-4.1",
    0.4,
    4500
  );

  return finalAnswer;
}

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {
  res.send("Elite CIMA SCS Bot Running");
});

// ======================================================
// TELEGRAM WEBHOOK
// ======================================================

app.post("/webhook", async (req, res) => {

  try {

    console.log("Incoming webhook");

    const message = req.body.message;

    if (!message || !message.text) {
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;

    const incomingText = cleanText(message.text);

    // ==================================================
    // CREATE SESSION
    // ==================================================

    if (!sessions[chatId]) {
      sessions[chatId] = {
        firstMessage: null
      };
    }

    // ==================================================
    // FIRST MESSAGE
    // ==================================================

    if (!sessions[chatId].firstMessage) {

      sessions[chatId].firstMessage = incomingText;

      await sendTelegramMessage(
        chatId,
        `
📥 *First exhibit/question received.*

Please now send:
- additional exhibit
- appendices
- scenario material
- supporting information
`
      );

      return res.json({
        status: "waiting_for_second_message"
      });
    }

    // ==================================================
    // SECOND MESSAGE
    // ==================================================

    const firstInput = sessions[chatId].firstMessage;

    const combinedInput = `
MAIN REQUIREMENT:
${firstInput}

SUPPORTING EXHIBIT:
${incomingText}
`;

    // clear session
    sessions[chatId].firstMessage = null;

    // ==================================================
    // STATUS UPDATE
    // ==================================================

    await sendTelegramMessage(
      chatId,
      `
🧠 Generating examiner-quality strategic analysis...

This may take 30-60 seconds.
`
    );

    // ==================================================
    // GENERATE ANSWER
    // ==================================================

    const answer = await generateSCSAnswer(combinedInput);

    // ==================================================
    // SEND FINAL ANSWER
    // ==================================================

    await sendTelegramMessage(chatId, answer);

    return res.json({
      success: true
    });

  } catch (error) {

    console.error(
      "SERVER ERROR:",
      error.response?.data || error.message
    );

    try {

      if (req.body?.message?.chat?.id) {

        await sendTelegramMessage(
          req.body.message.chat.id,
          `
❌ Error generating response.

Please try again.
`
        );
      }

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
