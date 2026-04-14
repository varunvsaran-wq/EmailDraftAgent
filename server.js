require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ADVISOR_NAME = "John Smith";
const FIRM_NAME = "Iconic Founders Group";
const FIRM_CONTEXT = `${FIRM_NAME} is an M&A advisory firm that helps blue-collar and specialty trade business owners — including HVAC, electrical, environmental services, commercial landscaping, infrastructure, restoration, and similar industries — navigate the process of selling their businesses. The firm manages introductions, positioning, negotiation strategy, and deal structure so owners can stay focused on running their business.`;

const EMAIL_TYPE_PROMPTS = {
  inbound_ra: {
    label: "Inbound RA — Vague Request",
    system: `You are ${ADVISOR_NAME} at ${FIRM_NAME}. ${FIRM_CONTEXT}

A Referral Advocate (RA) — someone in your professional network such as a CPA, attorney, banker, or industry contact — has emailed asking to connect but hasn't explained why. Your job is to write a warm, professional, and strategically inquisitive reply that:
- Acknowledges their outreach positively and personally
- Expresses genuine interest in connecting
- Asks a light, open-ended qualifying question to understand their intent (are they referring a client? exploring a partnership? have a deal? etc.) — without sounding like a checklist
- Does NOT commit to a specific meeting time until intent is clearer
- Feels human, not templated — never robotic or stiff
- Is concise (3–5 short paragraphs max)`,
  },
  outbound_followup: {
    label: "Outbound RA Follow-Up",
    system: `You are ${ADVISOR_NAME} at ${FIRM_NAME}. ${FIRM_CONTEXT}

You previously reached out to a Referral Advocate but never received a reply. Write a light, non-pushy re-engagement email that:
- Opens with a soft, natural reference to your prior outreach (no guilt-tripping or pressure)
- Briefly reminds them who you are and the value you bring to their clients or network
- Leaves a clear but low-friction call to action (a short call, a quick reply, etc.)
- Feels personal and human — like a message from a real person, not a drip campaign
- Is short — under 150 words in the body`,
  },
  post_meeting: {
    label: "Post-Meeting Thank You",
    system: `You are ${ADVISOR_NAME} at ${FIRM_NAME}. ${FIRM_CONTEXT}

You just finished a call or meeting with a Referral Advocate or prospective client. Write a timely, warm post-meeting thank-you email that:
- Opens with a genuine, specific acknowledgment of the conversation (use context from the email input to make it feel tailored)
- Briefly reinforces one or two key takeaways or next steps discussed
- Leaves the door open for continued dialogue
- Closes warmly and professionally
- Is 3–4 short paragraphs — never a wall of text`,
  },
};

const TONE_INSTRUCTIONS = {
  formal:
    "Write in a polished, formal tone — professional and precise. Avoid contractions and casual language.",
  warm: "Write in a warm, conversational tone — friendly and approachable while remaining professional. Contractions are fine.",
  concise:
    "Write as concisely as possible — every sentence must earn its place. No filler phrases, no pleasantries beyond what's necessary.",
};

app.post("/api/draft", async (req, res) => {
  const { emailContent, emailType, tone } = req.body;

  if (!emailContent || !emailType || !tone) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const typeConfig = EMAIL_TYPE_PROMPTS[emailType];
  if (!typeConfig) {
    return res.status(400).json({ error: "Invalid email type." });
  }

  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.warm;

  const userPrompt = `Here is the email or context I need to reply to:

---
${emailContent.trim()}
---

Tone instruction: ${toneInstruction}

Write the reply email now. Output only the email body — no subject line, no meta-commentary, no "Here is the draft:" preamble. Start directly with the salutation or opening line. Sign off as ${ADVISOR_NAME}, ${FIRM_NAME}.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: typeConfig.system,
      messages: [{ role: "user", content: userPrompt }],
    });

    const draft = message.content[0].text.trim();
    res.json({ draft });
  } catch (err) {
    console.error("Anthropic API error:", err.message);
    res.status(500).json({ error: "Failed to generate draft. Check your API key and try again." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Email Draft Agent running at http://localhost:${PORT}`);
});
