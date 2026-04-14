(() => {
  // ─── Element refs ───────────────────────────────────
  const generateBtn    = document.getElementById("generateBtn");
  const btnText        = document.getElementById("btnText");
  const btnSpinner     = document.getElementById("btnSpinner");
  const emailInput     = document.getElementById("emailInput");
  const draftOutput    = document.getElementById("draftOutput");
  const emptyState     = document.getElementById("emptyState");
  const errorState     = document.getElementById("errorState");
  const errorMessage   = document.getElementById("errorMessage");
  const copyBtn        = document.getElementById("copyBtn");
  const clearBtn       = document.getElementById("clearBtn");
  const draftMeta      = document.getElementById("draftMeta");
  const wordCount      = document.getElementById("wordCount");
  const draftTypeLabel = document.getElementById("draftTypeLabel");
  const draftToneLabel = document.getElementById("draftToneLabel");
  const headerAuth     = document.getElementById("headerAuth");
  const inboxDrawer    = document.getElementById("inboxDrawer");
  const inboxOverlay   = document.getElementById("inboxOverlay");
  const inboxList      = document.getElementById("inboxList");
  const closeInbox     = document.getElementById("closeInbox");
  const outlookFields  = document.getElementById("outlookFields");
  const outlookActions = document.getElementById("outlookActions");
  const outlookStatus  = document.getElementById("outlookStatus");
  const sendTo         = document.getElementById("sendTo");
  const sendSubject    = document.getElementById("sendSubject");
  const saveDraftBtn   = document.getElementById("saveDraftBtn");
  const sendBtn        = document.getElementById("sendBtn");

  const TYPE_LABELS = {
    inbound_ra:        "Inbound RA",
    outbound_followup: "Outbound Follow-Up",
    post_meeting:      "Post-Meeting",
  };

  const TONE_LABELS = { warm: "Warm", formal: "Formal", concise: "Concise" };

  let isAuthenticated = false;

  // ─── Auth ────────────────────────────────────────────
  async function checkAuth() {
    try {
      const res = await fetch("/api/me");
      const data = await res.json();
      isAuthenticated = data.authenticated;
      renderAuthBar(data);
    } catch {
      renderAuthBar({ authenticated: false });
    }
  }

  function renderAuthBar(data) {
    if (data.authenticated) {
      const initials = (data.user.name || "U")
        .split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
      headerAuth.innerHTML = `
        <div class="auth-user">
          <div class="auth-avatar">${initials}</div>
          <span class="auth-name">${data.user.name || data.user.email}</span>
        </div>
        <button class="inbox-btn" id="inboxToggle">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
          </svg>
          Inbox
        </button>
        <a href="/auth/logout" class="signout-btn">Sign out</a>
      `;
      document.getElementById("inboxToggle").addEventListener("click", openInbox);
      outlookFields.classList.remove("hidden");
    } else {
      headerAuth.innerHTML = `
        <a href="/auth/login" class="signin-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          Sign in with Outlook
        </a>
      `;
      outlookFields.classList.add("hidden");
    }

    // Show auth error if redirected back with error
    if (window.location.search.includes("auth_error=1")) {
      showOutlookStatus("Sign-in failed. Check your Azure app configuration.", "error");
      history.replaceState({}, "", "/");
    }
  }

  // ─── Inbox Drawer ────────────────────────────────────
  function openInbox() {
    inboxDrawer.classList.remove("hidden");
    inboxOverlay.classList.remove("hidden");
    loadInbox();
  }

  function closeInboxDrawer() {
    inboxDrawer.classList.add("hidden");
    inboxOverlay.classList.add("hidden");
  }

  closeInbox.addEventListener("click", closeInboxDrawer);
  inboxOverlay.addEventListener("click", closeInboxDrawer);

  async function loadInbox() {
    inboxList.innerHTML = '<div class="inbox-loading">Loading emails&hellip;</div>';
    try {
      const res = await fetch("/api/emails");
      if (res.status === 401) {
        inboxList.innerHTML = '<div class="inbox-loading">Please sign in to view your inbox.</div>';
        return;
      }
      const emails = await res.json();
      if (!emails.length) {
        inboxList.innerHTML = '<div class="inbox-loading">No emails found.</div>';
        return;
      }
      inboxList.innerHTML = emails.map(email => {
        const from = email.from?.emailAddress;
        const senderName = from?.name || from?.address || "Microsoft Notification";
        const subject    = email.subject || "(no subject)";
        const date = new Date(email.receivedDateTime).toLocaleDateString("en-US", {
          month: "short", day: "numeric"
        });
        const unreadClass = !email.isRead ? " unread" : "";
        return `
          <div class="inbox-item${unreadClass}" data-id="${email.id}" data-from="${escHtml(from?.address || "")}" data-subject="${escHtml(subject)}">
            <div class="inbox-item-from">${escHtml(senderName)}</div>
            <div class="inbox-item-subject">${escHtml(subject)}</div>
            <div class="inbox-item-preview">${escHtml(email.bodyPreview || "")}</div>
            <div class="inbox-item-date">${date}</div>
          </div>
        `;
      }).join("");

      inboxList.querySelectorAll(".inbox-item").forEach(item => {
        item.addEventListener("click", () => loadEmail(
          item.dataset.id,
          item.dataset.from,
          item.dataset.subject
        ));
      });
    } catch {
      inboxList.innerHTML = '<div class="inbox-loading">Failed to load emails.</div>';
    }
  }

  async function loadEmail(id, from, subject) {
    closeInboxDrawer();
    emailInput.value = "Loading email…";
    emailInput.disabled = true;

    try {
      const res = await fetch(`/api/emails/${id}`);
      const email = await res.json();

      // Strip HTML tags from body if HTML content type
      let body = email.body?.content || "";
      if (email.body?.contentType === "html") {
        const tmp = document.createElement("div");
        tmp.innerHTML = body;
        body = tmp.innerText;
      }
      body = body.trim().replace(/\n{3,}/g, "\n\n");

      emailInput.value = body;
      sendTo.value = from || "";
      sendSubject.value = subject ? `Re: ${subject.replace(/^Re:\s*/i, "")}` : "";
    } catch {
      emailInput.value = "";
    } finally {
      emailInput.disabled = false;
    }
  }

  // ─── Type card highlight ──────────────────────────────
  document.querySelectorAll(".type-card input").forEach(radio => {
    radio.addEventListener("change", () => {
      document.querySelectorAll(".type-card").forEach(c => c.classList.remove("selected"));
      radio.closest(".type-card").classList.add("selected");
    });
  });

  // ─── Helpers ─────────────────────────────────────────
  function getSelectedValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : null;
  }

  function countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function escHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ─── Draft state ──────────────────────────────────────
  function setLoading(loading) {
    generateBtn.disabled = loading;
    btnText.textContent = loading ? "Generating…" : "Generate Draft";
    btnSpinner.classList.toggle("hidden", !loading);
  }

  function showDraft(text, emailType, tone) {
    emptyState.classList.add("hidden");
    errorState.classList.add("hidden");
    draftOutput.classList.remove("hidden");
    draftMeta.classList.remove("hidden");
    copyBtn.classList.remove("hidden");
    clearBtn.classList.remove("hidden");
    outlookStatus.classList.add("hidden");

    draftOutput.value = text;
    wordCount.textContent = `${countWords(text)} words`;
    draftTypeLabel.textContent = TYPE_LABELS[emailType] || emailType;
    draftToneLabel.textContent = `${TONE_LABELS[tone] || tone} tone`;

    if (isAuthenticated) outlookActions.classList.remove("hidden");
  }

  function showError(msg) {
    emptyState.classList.add("hidden");
    draftOutput.classList.add("hidden");
    draftMeta.classList.add("hidden");
    copyBtn.classList.add("hidden");
    clearBtn.classList.add("hidden");
    outlookActions.classList.add("hidden");
    errorState.classList.remove("hidden");
    errorMessage.textContent = msg;
  }

  function showEmpty() {
    emptyState.classList.remove("hidden");
    draftOutput.classList.add("hidden");
    draftMeta.classList.add("hidden");
    errorState.classList.add("hidden");
    copyBtn.classList.add("hidden");
    clearBtn.classList.add("hidden");
    outlookActions.classList.add("hidden");
    outlookStatus.classList.add("hidden");
  }

  function showOutlookStatus(msg, type) {
    outlookStatus.textContent = msg;
    outlookStatus.className = `outlook-status ${type}`;
    outlookStatus.classList.remove("hidden");
    if (type === "success") setTimeout(() => outlookStatus.classList.add("hidden"), 4000);
  }

  // ─── Generate Draft ───────────────────────────────────
  generateBtn.addEventListener("click", async () => {
    const emailContent = emailInput.value.trim();
    const emailType    = getSelectedValue("emailType");
    const tone         = getSelectedValue("tone");

    if (!emailContent) {
      emailInput.focus();
      emailInput.style.borderColor = "var(--error)";
      setTimeout(() => (emailInput.style.borderColor = ""), 1500);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailContent, emailType, tone }),
      });
      const data = await res.json();
      if (!res.ok) showError(data.error || "Something went wrong. Please try again.");
      else showDraft(data.draft, emailType, tone);
    } catch {
      showError("Could not reach the server. Make sure it is running on port 3001.");
    } finally {
      setLoading(false);
    }
  });

  // ─── Live word count ──────────────────────────────────
  draftOutput.addEventListener("input", () => {
    wordCount.textContent = `${countWords(draftOutput.value)} words`;
  });

  // ─── Copy ─────────────────────────────────────────────
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(draftOutput.value);
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      }, 1800);
    } catch { copyBtn.textContent = "Failed"; }
  });

  clearBtn.addEventListener("click", showEmpty);

  // ─── Send via Outlook ─────────────────────────────────
  sendBtn.addEventListener("click", async () => {
    const to      = sendTo.value.trim();
    const subject = sendSubject.value.trim();
    const body    = draftOutput.value.trim();

    if (!to)      { sendTo.focus();      showOutlookStatus("Please enter a recipient email address.", "error"); return; }
    if (!subject) { sendSubject.focus(); showOutlookStatus("Please enter a subject line.", "error"); return; }
    if (!body)    { showOutlookStatus("Draft is empty.", "error"); return; }

    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) showOutlookStatus(data.error || "Failed to send.", "error");
      else showOutlookStatus("Email sent successfully via Outlook.", "success");
    } catch {
      showOutlookStatus("Could not reach the server.", "error");
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send via Outlook`;
    }
  });

  // ─── Save as Outlook Draft ────────────────────────────
  saveDraftBtn.addEventListener("click", async () => {
    const to      = sendTo.value.trim();
    const subject = sendSubject.value.trim();
    const body    = draftOutput.value.trim();

    if (!subject) { sendSubject.focus(); showOutlookStatus("Please enter a subject line.", "error"); return; }
    if (!body)    { showOutlookStatus("Draft is empty.", "error"); return; }

    saveDraftBtn.disabled = true;
    saveDraftBtn.textContent = "Saving…";
    try {
      const res = await fetch("/api/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) showOutlookStatus(data.error || "Failed to save draft.", "error");
      else showOutlookStatus("Draft saved to your Outlook Drafts folder.", "success");
    } catch {
      showOutlookStatus("Could not reach the server.", "error");
    } finally {
      saveDraftBtn.disabled = false;
      saveDraftBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save to Outlook Drafts`;
    }
  });

  // ─── Ctrl+Enter shortcut ──────────────────────────────
  emailInput.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") generateBtn.click();
  });

  // ─── Init ─────────────────────────────────────────────
  checkAuth();
})();
