function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeDomainEntry(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  return hostFromUrl(text.includes("://") ? text : `https://${text}`);
}

async function domainDisabled(host) {
  const { gvDisabledDomains } = await chrome.storage.sync.get({ gvDisabledDomains: [] });
  const normalizedHost = normalizeDomainEntry(host);
  const disabledDomains = Array.isArray(gvDisabledDomains) ? gvDisabledDomains.map(normalizeDomainEntry).filter(Boolean) : [];
  return Boolean(normalizedHost && disabledDomains.includes(normalizedHost));
}

async function clearPendingPrompts() {
  await chrome.storage.session.remove("pendingSaveLogin");
  await chrome.storage.session.remove("pendingUpdateLogin");
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function fillTab(tabId, username, password) {
  return chrome.tabs.sendMessage(tabId, { type: "GV_FILL_LOGIN", username, password });
}

async function autosaveEnabled() {
  const { gvAutosaveEnabled } = await chrome.storage.sync.get({ gvAutosaveEnabled: true });
  return gvAutosaveEnabled !== false;
}

async function autofillEnabled() {
  const { gvAutofillEnabled } = await chrome.storage.sync.get({ gvAutofillEnabled: true });
  return gvAutofillEnabled !== false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "GV_FORMS_DETECTED") {
      const detected = { ...message, tabId: sender.tab?.id, at: new Date().toISOString() };
      await chrome.storage.session.set({ lastDetectedForms: detected });

      const { sessionAutofill } = await chrome.storage.session.get("sessionAutofill");
      const host = hostFromUrl(message.url);
      if (!await domainDisabled(host) && await autofillEnabled() && sender.tab?.id && sessionAutofill?.host === host && sessionAutofill.username && sessionAutofill.password) {
        await fillTab(sender.tab.id, sessionAutofill.username, sessionAutofill.password);
      }
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "GV_SAVE_SESSION_LOGIN") {
      const tab = await activeTab();
      await chrome.storage.session.set({
        sessionAutofill: {
          host: hostFromUrl(tab?.url),
          username: message.username || "",
          password: message.password || "",
          at: new Date().toISOString(),
        },
      });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "GV_LOGIN_SUBMITTED") {
      const host = hostFromUrl(message.url) || hostFromUrl(`https://${message.host || ""}`);
      if (!await autosaveEnabled() || await domainDisabled(host)) {
        await clearPendingPrompts();
        sendResponse({ ok: true });
        return;
      }

      const { sessionAutofill } = await chrome.storage.session.get("sessionAutofill");
      if (sessionAutofill?.host === host && sessionAutofill.username === message.username) {
        if (sessionAutofill.password && sessionAutofill.password !== message.password) {
          await chrome.storage.session.set({
            pendingUpdateLogin: {
              host,
              url: message.url || "",
              username: message.username || "",
              oldPassword: sessionAutofill.password,
              password: message.password || "",
              tabId: sender.tab?.id,
              at: new Date().toISOString(),
            },
          });
          await chrome.storage.session.remove("pendingSaveLogin");
          sendResponse({ ok: true });
          return;
        }
        await chrome.storage.session.remove("pendingSaveLogin");
        await chrome.storage.session.remove("pendingUpdateLogin");
        sendResponse({ ok: true });
        return;
      }
      await chrome.storage.session.set({
        pendingSaveLogin: {
          host,
          url: message.url || "",
          username: message.username || "",
          password: message.password || "",
          tabId: sender.tab?.id,
          at: new Date().toISOString(),
        },
      });
      await chrome.storage.session.remove("pendingUpdateLogin");
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "GV_DISMISS_UPDATE_LOGIN") {
      await chrome.storage.session.remove("pendingUpdateLogin");
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "GV_DISMISS_SAVE_LOGIN") {
      await chrome.storage.session.remove("pendingSaveLogin");
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "GV_FILL_ACTIVE_TAB") {
      const tab = await activeTab();
      if (!tab?.id) {
        sendResponse({ ok: false, error: "No active tab." });
        return;
      }
      await fillTab(tab.id, message.username || "", message.password || "");
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message." });
  })().catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
