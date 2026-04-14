require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const Anthropic = require("@anthropic-ai/sdk");
const msal = require("@azure/msal-node");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "ifg-email-agent-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 },
}));
app.use(express.static(path.join(__dirname, "public")));

// ─── Anthropic ────────────────────────────────────────
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
  formal: "Write in a polished, formal tone — professional and precise. Avoid contractions and casual language.",
  warm: "Write in a warm, conversational tone — friendly and approachable while remaining professional. Contractions are fine.",
  concise: "Write as concisely as possible — every sentence must earn its place. No filler phrases, no pleasantries beyond what's necessary.",
};

// ─── MSAL / Outlook Auth ──────────────────────────────
const REDIRECT_URI = `http://localhost:${process.env.PORT || 4000}/auth/callback`;
const GRAPH_SCOPES = [
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/User.Read",
];

const pca = new msal.ConfidentialClientApplication({
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: "https://login.microsoftonline.com/common",
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
});

app.get("/auth/login", async (req, res) => {
  try {
    const url = await pca.getAuthCodeUrl({ scopes: GRAPH_SCOPES, redirectUri: REDIRECT_URI, prompt: "select_account" });
    res.redirect(url);
  } catch (err) {
    console.error("Auth login error:", err.message);
    res.redirect("/?auth_error=1");
  }
});

app.get("/auth/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    console.error("Auth error from Microsoft:", error, req.query.error_description);
    return res.redirect("/?auth_error=1");
  }
  try {
    const result = await pca.acquireTokenByCode({
      code,
      scopes: GRAPH_SCOPES,
      redirectUri: REDIRECT_URI,
    });
    req.session.accessToken = result.accessToken;
    req.session.user = { name: result.account.name, email: result.account.username };
    res.redirect("/");
  } catch (err) {
    console.error("Auth callback error:", err.message);
    res.redirect("/?auth_error=1");
  }
});

app.get("/auth/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// ─── Middleware ───────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.accessToken) return res.status(401).json({ error: "Not authenticated" });
  next();
}

// ─── Graph API helpers ────────────────────────────────
async function graphGet(token, endpoint) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    console.error(`Graph ${r.status} on ${endpoint}:`, JSON.stringify(e.error || e));
    throw new Error(e.error?.message || `Graph error ${r.status}`);
  }
  return r.json();
}

async function graphPost(token, endpoint, body) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    console.error(`Graph POST ${r.status} on ${endpoint}:`, JSON.stringify(e.error || e));
    throw new Error(e.error?.message || `Graph error ${r.status}`);
  }
  if (r.status === 204) return { success: true };
  const text = await r.text();
  return text ? JSON.parse(text) : { success: true };
}

// ─── Auth status ──────────────────────────────────────
app.get("/api/me", (req, res) => {
  if (!req.session.accessToken) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: req.session.user });
});

// ─── Token debug (remove after troubleshooting) ───────
app.get("/api/debug-token", (req, res) => {
  if (!req.session.accessToken) return res.json({ error: "No token in session" });
  try {
    const parts = req.session.accessToken.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    res.json({
      aud: payload.aud,
      scp: payload.scp,
      roles: payload.roles,
      upn: payload.upn || payload.preferred_username,
      exp: new Date(payload.exp * 1000).toISOString(),
    });
  } catch {
    res.json({ error: "Could not decode token", token_prefix: req.session.accessToken.slice(0, 30) });
  }
});

// ─── Folder check (debug) ─────────────────────────────
app.get("/api/check-folders", requireAuth, async (req, res) => {
  try {
    const [drafts, sent] = await Promise.all([
      graphGet(req.session.accessToken, "/me/mailFolders/drafts/messages?$top=3&$select=id,subject,createdDateTime&$orderby=createdDateTime desc"),
      graphGet(req.session.accessToken, "/me/mailFolders/sentitems/messages?$top=3&$select=id,subject,sentDateTime&$orderby=sentDateTime desc"),
    ]);
    res.json({
      drafts: drafts.value.map(m => ({ id: m.id, subject: m.subject, created: m.createdDateTime })),
      sent:   sent.value.map(m => ({ id: m.id, subject: m.subject, sent: m.sentDateTime })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Inbox ────────────────────────────────────────────
app.get("/api/emails", requireAuth, async (req, res) => {
  try {
    const data = await graphGet(
      req.session.accessToken,
      "/me/mailFolders/inbox/messages?$top=25&$select=id,subject,from,receivedDateTime,bodyPreview,isRead&$orderby=receivedDateTime desc"
    );
    res.json(data.value);
  } catch (err) {
    console.error("Inbox error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/emails/:id", requireAuth, async (req, res) => {
  try {
    const data = await graphGet(
      req.session.accessToken,
      `/me/messages/${req.params.id}?$select=id,subject,from,body,receivedDateTime,toRecipients`
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Send email ───────────────────────────────────────
app.post("/api/send", requireAuth, async (req, res) => {
  const { to, subject, body } = req.body;
  if (!to || !subject || !body) return res.status(400).json({ error: "Missing to, subject, or body." });
  try {
    await graphPost(req.session.accessToken, "/me/sendMail", {
      message: {
        subject,
        body: { contentType: "Text", content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Send error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Save as Outlook draft ────────────────────────────
app.post("/api/save-draft", requireAuth, async (req, res) => {
  const { to, subject, body } = req.body;
  if (!subject || !body) return res.status(400).json({ error: "Missing subject or body." });
  try {
    const draft = await graphPost(req.session.accessToken, "/me/mailFolders/drafts/messages", {
      subject,
      body: { contentType: "Text", content: body },
      ...(to && { toRecipients: [{ emailAddress: { address: to } }] }),
    });
    res.json({ success: true, id: draft.id });
  } catch (err) {
    console.error("Save draft error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Draft ─────────────────────────────────────────
app.post("/api/draft", async (req, res) => {
  const { emailContent, emailType, tone } = req.body;
  if (!emailContent || !emailType || !tone) return res.status(400).json({ error: "Missing required fields." });

  const typeConfig = EMAIL_TYPE_PROMPTS[emailType];
  if (!typeConfig) return res.status(400).json({ error: "Invalid email type." });

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
    res.json({ draft: message.content[0].text.trim() });
  } catch (err) {
    console.error("Anthropic error:", err.message);
    res.status(500).json({ error: "Failed to generate draft. Check your API key and try again." });
  }
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => console.log(`Email Draft Agent running at http://localhost:${PORT}`));
server.on("error", err => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nPort ${PORT} is already in use. Kill the existing process and try again.\nRun: netstat -ano | findstr :${PORT}\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
