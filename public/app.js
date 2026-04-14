(() => {
  const generateBtn   = document.getElementById("generateBtn");
  const btnText       = document.getElementById("btnText");
  const btnSpinner    = document.getElementById("btnSpinner");
  const emailInput    = document.getElementById("emailInput");
  const draftOutput   = document.getElementById("draftOutput");
  const emptyState    = document.getElementById("emptyState");
  const errorState    = document.getElementById("errorState");
  const errorMessage  = document.getElementById("errorMessage");
  const copyBtn       = document.getElementById("copyBtn");
  const clearBtn      = document.getElementById("clearBtn");
  const draftMeta     = document.getElementById("draftMeta");
  const wordCount     = document.getElementById("wordCount");
  const draftTypeLabel = document.getElementById("draftTypeLabel");
  const draftToneLabel = document.getElementById("draftToneLabel");

  const TYPE_LABELS = {
    inbound_ra:        "Inbound RA",
    outbound_followup: "Outbound Follow-Up",
    post_meeting:      "Post-Meeting",
  };

  const TONE_LABELS = {
    warm:    "Warm",
    formal:  "Formal",
    concise: "Concise",
  };

  // Highlight active type card on click
  document.querySelectorAll(".type-card input").forEach((radio) => {
    radio.addEventListener("change", () => {
      document.querySelectorAll(".type-card").forEach((c) =>
        c.classList.remove("selected")
      );
      radio.closest(".type-card").classList.add("selected");
    });
  });

  function getSelectedValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : null;
  }

  function countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function setLoading(loading) {
    generateBtn.disabled = loading;
    btnText.textContent = loading ? "Generating..." : "Generate Draft";
    btnSpinner.classList.toggle("hidden", !loading);
  }

  function showDraft(text, emailType, tone) {
    emptyState.classList.add("hidden");
    errorState.classList.add("hidden");
    draftOutput.classList.remove("hidden");
    draftMeta.classList.remove("hidden");
    copyBtn.classList.remove("hidden");
    clearBtn.classList.remove("hidden");

    draftOutput.value = text;
    wordCount.textContent = `${countWords(text)} words`;
    draftTypeLabel.textContent = TYPE_LABELS[emailType] || emailType;
    draftToneLabel.textContent = `${TONE_LABELS[tone] || tone} tone`;
  }

  function showError(msg) {
    emptyState.classList.add("hidden");
    draftOutput.classList.add("hidden");
    draftMeta.classList.add("hidden");
    copyBtn.classList.add("hidden");
    clearBtn.classList.add("hidden");
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
  }

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

      if (!res.ok) {
        showError(data.error || "Something went wrong. Please try again.");
      } else {
        showDraft(data.draft, emailType, tone);
      }
    } catch (err) {
      showError("Could not reach the server. Make sure it is running on port 3000.");
    } finally {
      setLoading(false);
    }
  });

  // Update word count live as user edits the draft
  draftOutput.addEventListener("input", () => {
    wordCount.textContent = `${countWords(draftOutput.value)} words`;
  });

  copyBtn.addEventListener("click", async () => {
    const text = draftOutput.value;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      }, 1800);
    } catch {
      copyBtn.textContent = "Failed";
    }
  });

  clearBtn.addEventListener("click", () => {
    showEmpty();
  });

  // Allow Ctrl+Enter / Cmd+Enter to generate
  emailInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      generateBtn.click();
    }
  });
})();
