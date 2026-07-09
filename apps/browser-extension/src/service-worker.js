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

function normalizeEquivalentDomainGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return groups
    .map((group) => [...new Set((Array.isArray(group) ? group : [])
      .map(normalizeDomainEntry)
      .filter(Boolean))])
    .filter((group) => group.length > 1);
}

function hostsEquivalent(hostA, hostB, equivalentDomainGroups) {
  const normalizedA = normalizeDomainEntry(hostA);
  const normalizedB = normalizeDomainEntry(hostB);
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;
  return normalizeEquivalentDomainGroups(equivalentDomainGroups)
    .some((group) => group.includes(normalizedA) && group.includes(normalizedB));
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

async function fillPromptEnabled() {
  const { gvFillPromptEnabled } = await chrome.storage.sync.get({ gvFillPromptEnabled: true });
  return gvFillPromptEnabled !== false;
}

function normalizeSessionLogin(login) {
  const host = hostFromUrl(login?.url) || normalizeDomainEntry(login?.host);
  const username = String(login?.username || "");
  const password = String(login?.password || "");
  if (!host || !username || !password) return null;
  return {
    host,
    username,
    password,
    at: login?.at || new Date().toISOString(),
  };
}

function upsertSessionLogin(logins, login) {
  const next = (Array.isArray(logins) ? logins : [])
    .map(normalizeSessionLogin)
    .filter(Boolean)
    .filter((item) => !(item.host === login.host && item.username === login.username));
  next.push(login);
  return next;
}

function matchingSessionLogins({ sessionAutofill, sessionAutofillLogins }, host, equivalentDomainGroups = []) {
  const logins = (Array.isArray(sessionAutofillLogins) && sessionAutofillLogins.length > 0)
    ? sessionAutofillLogins
    : [sessionAutofill];
  return logins
    .map(normalizeSessionLogin)
    .filter(Boolean)
    .filter((login) => hostsEquivalent(login.host, host, equivalentDomainGroups));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "GV_FORMS_DETECTED") {
      const sessionState = await chrome.storage.session.get(["sessionAutofill", "sessionAutofillLogins"]);
      const { gvEquivalentDomains } = await chrome.storage.sync.get({ gvEquivalentDomains: [] });
      const host = hostFromUrl(message.url);
      const matches = matchingSessionLogins(sessionState, host, gvEquivalentDomains);
      const detected = {
        ...message,
        tabId: sender.tab?.id,
        at: new Date().toISOString(),
        matchingLoginCount: matches.length,
        noMatchingLogin: (message.count || 0) > 0 && matches.length === 0,
      };
      const promptsEnabled = await fillPromptEnabled();
      if (promptsEnabled) {
        await chrome.storage.session.set({ lastDetectedForms: detected });
      } else {
        await chrome.storage.session.remove("lastDetectedForms");
      }

      if (!await domainDisabled(host) && await autofillEnabled() && sender.tab?.id) {
        if (matches.length === 1) {
          await chrome.storage.session.remove("pendingFillChoices");
          await fillTab(sender.tab.id, matches[0].username, matches[0].password);
        } else if (matches.length > 1 && promptsEnabled) {
          await chrome.storage.session.set({
            pendingFillChoices: {
              host,
              tabId: sender.tab.id,
              choices: matches,
              at: new Date().toISOString(),
            },
          });
        } else {
          await chrome.storage.session.remove("pendingFillChoices");
        }
      } else if (matches.length < 2) {
        await chrome.storage.session.remove("pendingFillChoices");
      }
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "GV_SAVE_SESSION_LOGIN") {
      const tab = await activeTab();
      const login = normalizeSessionLogin({
        host: hostFromUrl(tab?.url),
        username: message.username,
        password: message.password,
      });
      if (!login) {
        sendResponse({ ok: false, error: "Username and password are required." });
        return;
      }
      const { sessionAutofillLogins } = await chrome.storage.session.get("sessionAutofillLogins");
      await chrome.storage.session.set({
        sessionAutofill: login,
        sessionAutofillLogins: upsertSessionLogin(sessionAutofillLogins, login),
      });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "GV_FILL_CHOICE") {
      const { pendingFillChoices } = await chrome.storage.session.get("pendingFillChoices");
      const choiceIndex = Number(message.choiceIndex);
      const choice = Array.isArray(pendingFillChoices?.choices) ? pendingFillChoices.choices[choiceIndex] : null;
      const login = normalizeSessionLogin({ ...choice, host: pendingFillChoices?.host });
      if (!Number.isInteger(choiceIndex) || !login || !pendingFillChoices?.tabId) {
        sendResponse({ ok: false, error: "Selected login is no longer available." });
        return;
      }
      if (!await autofillEnabled() || await domainDisabled(login.host)) {
        await chrome.storage.session.remove("pendingFillChoices");
        sendResponse({ ok: false, error: "Autofill is disabled for this site." });
        return;
      }
      const tab = await chrome.tabs.get(pendingFillChoices.tabId);
      if (hostFromUrl(tab?.url) !== login.host) {
        await chrome.storage.session.remove("pendingFillChoices");
        sendResponse({ ok: false, error: "Selected login is no longer available because the page changed." });
        return;
      }
      await fillTab(pendingFillChoices.tabId, login.username, login.password);
      await chrome.storage.session.remove("pendingFillChoices");
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

      const { sessionAutofill, sessionAutofillLogins } = await chrome.storage.session.get(["sessionAutofill", "sessionAutofillLogins"]);
      const { gvEquivalentDomains } = await chrome.storage.sync.get({ gvEquivalentDomains: [] });
      const knownLogin = matchingSessionLogins({ sessionAutofill, sessionAutofillLogins }, host, gvEquivalentDomains)
        .find((login) => login.username === message.username);
      if (knownLogin) {
        if (knownLogin.password && knownLogin.password !== message.password) {
          await chrome.storage.session.set({
            pendingUpdateLogin: {
              host,
              url: message.url || "",
              username: message.username || "",
              oldPassword: knownLogin.password,
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
