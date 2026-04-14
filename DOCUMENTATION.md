# Email Draft Agent — Documentation
### Iconic Founders Group | AI-Powered Email Drafting Tool

---

## Overview

An AI-powered web tool that reads email context and generates professional, ready-to-send reply drafts for three core M&A advisory email scenarios. Built for speed — paste an email or load one directly from Outlook, pick a type and tone, get a polished draft in seconds, then send or save it back to Outlook without leaving the tool.

---

## Tools & Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Node.js + Express | HTTP server, API routing, session management |
| **AI Model** | Anthropic Claude Haiku (`claude-haiku-4-5`) | Email draft generation |
| **AI SDK** | `@anthropic-ai/sdk` v0.39 | Anthropic API client |
| **Outlook Auth** | `@azure/msal-node` | Microsoft OAuth 2.0 (authorization code flow) |
| **Outlook API** | Microsoft Graph API | Read inbox, send email, save drafts |
| **Sessions** | `express-session` | Secure server-side token storage |
| **Frontend** | Vanilla HTML / CSS / JavaScript | UI — no framework, no build step |
| **Config** | `dotenv` | Secure API key management |
| **Dev** | `nodemon` | Auto-restart on file changes |

**Why this stack?**
- Node + Express keeps the server minimal and fast to set up
- Claude Haiku is optimized for speed and cost on short-form generation tasks
- MSAL Node is Microsoft's official library for OAuth — reliable and well-maintained
- Vanilla JS frontend means zero build step — open a browser and it works

---

## Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- An [Anthropic API key](https://console.anthropic.com/)
- A Microsoft Azure App Registration (for Outlook integration — optional, see below)

### 1. Clone or download the project

```bash
git clone <repo-url>
cd EmailDraftAgent
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file:

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```
ANTHROPIC_API_KEY=sk-ant-...your-key-here...
AZURE_CLIENT_ID=your-azure-client-id
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_CLIENT_SECRET=your-azure-client-secret
PORT=4000
```

> The Anthropic API key is required. The Azure credentials are only needed for the Outlook integration — the AI drafting works without them.

### 4. Start the server

```bash
npm start
```

The app will be available at **http://localhost:4000**

For development with auto-reload:
```bash
npm run dev
```

---

## Azure App Registration (Outlook Integration)

To enable sign-in with Outlook, inbox access, and sending/saving drafts:

1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active Directory** → **App Registrations** → **New Registration**
2. Set **Supported account types** to: *Accounts in any organizational directory and personal Microsoft accounts*
3. Add a **Redirect URI**: Platform = **Web**, URI = `http://localhost:4000/auth/callback`
4. Note your **Application (client) ID** and **Directory (tenant) ID** from the Overview page
5. Under **Certificates & Secrets** → create a new client secret → copy the **Value**
6. Under **API Permissions** → **Add a permission** → **Microsoft Graph** → **Delegated**:
   - `Mail.Read`
   - `Mail.Send`
   - `Mail.ReadWrite`
   - `User.Read`
7. Click **Grant admin consent**

---

## Using the Tool

### Without Outlook (manual mode)
1. **Select an email type** — choose one of the three cards on the left
2. **Pick a tone** — Warm, Formal, or Concise
3. **Paste the incoming email** into the text area
4. **Click Generate Draft** (or press `Ctrl+Enter`)
5. **Review and edit** the draft inline on the right
6. **Copy** to clipboard and paste into your email client

### With Outlook connected
1. Click **Sign in with Outlook** in the top right
2. Click **Inbox** to open your inbox drawer — click any email to load it into the compose area
3. Select email type and tone, then **Generate Draft**
4. Fill in the **To** and **Subject** fields (auto-populated when loading from inbox)
5. Click **Send via Outlook** to send immediately, or **Save to Outlook Drafts** to review in Outlook first

---

## Email Types

### 01 — Inbound RA (Vague Request)
A Referral Advocate emails asking to connect without explaining why. The agent writes a warm, inquisitive reply that qualifies their intent before committing to a meeting.

### 02 — Outbound RA Follow-Up
You previously reached out to a Referral Advocate and never heard back. The agent writes a brief, non-pushy re-engagement that feels personal, not automated.

### 03 — Post-Meeting Thank You
Following a call or meeting, the agent writes a timely thank-you that acknowledges the conversation, reinforces next steps, and leaves a strong impression.

---

## Project Structure

```
EmailDraftAgent/
├── server.js          # Express server, MSAL auth, Graph API, Anthropic integration
├── package.json       # Dependencies and scripts
├── .env               # API keys and secrets (never commit this)
├── .env.example       # Template for new environments
├── .gitignore
└── public/
    ├── index.html     # App layout and markup
    ├── style.css      # Styling (gold/charcoal/white theme)
    ├── app.js         # Frontend logic (auth, inbox, draft, send)
    └── Logo.PNG       # Iconic Founders Group logo
```

---

## What I'd Build Next

1. **HubSpot CRM sync** — auto-log drafted emails against the RA's contact record and tag engagement activity, so every outreach is tracked without manual data entry
2. **Conversation memory** — store prior email threads per contact so the agent has full context before writing follow-ups (e.g., "you last spoke 3 weeks ago about a plumbing business in Phoenix")
3. **Reply threading** — detect when an email is a reply and automatically load the full thread as context, so the draft acknowledges the full conversation history
4. **Template library** — let advisors save and rate their best drafts to continuously refine the prompts over time
5. **Multi-advisor support** — support multiple sender profiles beyond John Smith, each with their own voice, signature, and relationship history with specific RAs
