# Email Draft Agent — Documentation
### Iconic Founders Group | AI-Powered Email Drafting Tool

---

## Overview

An AI-powered web tool that reads email context and generates professional, ready-to-send reply drafts for three core M&A advisory email scenarios. Built for speed — paste an email, pick a type and tone, get a polished draft in seconds.

---

## Tools & Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Node.js + Express | HTTP server, API routing |
| **AI Model** | Anthropic Claude Haiku (`claude-haiku-4-5`) | Email draft generation |
| **AI SDK** | `@anthropic-ai/sdk` v0.39 | Anthropic API client |
| **Frontend** | Vanilla HTML / CSS / JavaScript | UI — no framework overhead |
| **Config** | `dotenv` | Secure API key management |
| **Dev** | `nodemon` | Auto-restart on file changes |

**Why this stack?**
- Node + Express keeps the server minimal and fast to set up
- Claude Haiku is optimized for speed and cost on short-form generation tasks
- Vanilla JS frontend means zero build step — open a browser and it works

---

## Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone or download the project

```bash
# If cloning from git
git clone <repo-url>
cd EmailDraftAgent

# Or just navigate into the folder
cd path/to/EmailDraftAgent
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure your API key

Copy the example env file and add your key:

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder:

```
ANTHROPIC_API_KEY=sk-ant-...your-key-here...
PORT=3001
```

### 4. Start the server

```bash
npm start
```

The app will be available at **http://localhost:3001**

For development with auto-reload:
```bash
npm run dev
```

---

## Using the Tool

1. **Select an email type** — choose one of the three cards on the left
2. **Pick a tone** — Warm, Formal, or Concise
3. **Paste your email** — drop in the incoming message, or describe the context for follow-ups
4. **Click Generate Draft** (or press `Ctrl+Enter`)
5. **Review and edit** the draft on the right — it's a live editable text area
6. **Copy** to clipboard when ready to paste into Outlook

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
├── server.js          # Express server + Anthropic API integration + prompts
├── package.json       # Dependencies and scripts
├── .env               # API key (never commit this)
├── .env.example       # Template for new environments
├── .gitignore
└── public/
    ├── index.html     # App layout and markup
    ├── style.css      # Styling (gold/charcoal/white theme)
    └── app.js         # Frontend logic (fetch, state, clipboard)
```

---

## What I'd Build Next

1. **Microsoft Graph API integration** — connect directly to Outlook so emails load automatically and drafts are pushed back as reply drafts without copy-pasting
2. **HubSpot CRM sync** — auto-log drafted emails against the RA's contact record and tag engagement activity
3. **Conversation memory** — store prior email threads per contact so the agent has context before writing follow-ups (e.g., "you last spoke 3 weeks ago about a plumbing business in Phoenix")
4. **Template library** — let advisors save and rate their best drafts to continuously improve the prompts
5. **Multi-sender support** — support multiple advisor profiles beyond John Smith, each with their own voice and relationship history
