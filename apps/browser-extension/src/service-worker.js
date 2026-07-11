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

function normalizeUrlEntry(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text.includes("://") ? text : `https://${text}`);
    url.hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
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

function hostMatchesSubdomainRule(loginHost, pageHost, subdomainMatchingEnabled = true) {
  const normalizedLoginHost = normalizeDomainEntry(loginHost);
  const normalizedPageHost = normalizeDomainEntry(pageHost);
  if (!subdomainMatchingEnabled || !normalizedLoginHost || !normalizedPageHost) return false;
  return normalizedPageHost.endsWith(`.${normalizedLoginHost}`);
}

function hostsEquivalent(hostA, hostB, equivalentDomainGroups, subdomainMatchingEnabled = true) {
  const normalizedA = normalizeDomainEntry(hostA);
  const normalizedB = normalizeDomainEntry(hostB);
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;
  if (hostMatchesSubdomainRule(normalizedA, normalizedB, subdomainMatchingEnabled)) return true;
  return normalizeEquivalentDomainGroups(equivalentDomainGroups)
    .some((group) => group.includes(normalizedA) && group.includes(normalizedB));
}

function normalizeMatchMode(value) {
  const matchMode = String(value || "").trim().toLowerCase();
  return ["domain", "exact-host", "url-exact", "url-prefix"].includes(matchMode) ? matchMode : "domain";
}

function loginMatchesPage(login, pageUrl, pageHost, equivalentDomainGroups = [], subdomainMatchingEnabled = true) {
  const normalizedLogin = normalizeSessionLogin(login);
  const normalizedPageHost = normalizeDomainEntry(pageHost) || hostFromUrl(pageUrl);
  if (!normalizedLogin || !normalizedPageHost) return false;
  if (normalizedLogin.matchMode === "exact-host") return normalizedLogin.host === normalizedPageHost;
  if (normalizedLogin.matchMode === "url-exact") {
    const pageMatchUrl = normalizeUrlEntry(pageUrl);
    return Boolean(pageMatchUrl && normalizedLogin.matchUrl && pageMatchUrl === normalizedLogin.matchUrl);
  }
  if (normalizedLogin.matchMode === "url-prefix") {
    const pageMatchUrl = normalizeUrlEntry(pageUrl);
    return Boolean(pageMatchUrl && normalizedLogin.matchUrl && pageMatchUrl.startsWith(normalizedLogin.matchUrl));
  }
  return hostsEquivalent(normalizedLogin.host, normalizedPageHost, equivalentDomainGroups, subdomainMatchingEnabled);
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
  const normalizedUrl = normalizeUrlEntry(login?.url);
  const host = hostFromUrl(normalizedUrl) || normalizeDomainEntry(login?.host);
  const username = String(login?.username || "");
  const password = String(login?.password || "");
  if (!host || !username || !password) return null;
  const matchMode = normalizeMatchMode(login?.matchMode);
  const matchUrl = normalizeUrlEntry(login?.matchUrl) || (matchMode.startsWith("url-") ? normalizedUrl : "");
  return {
    host,
    url: normalizedUrl,
    username,
    password,
    matchMode,
    matchUrl,
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

function matchingSessionLogins({ sessionAutofill, sessionAutofillLogins }, pageUrl, host, equivalentDomainGroups = [], subdomainMatchingEnabled = true) {
  const logins = (Array.isArray(sessionAutofillLogins) && sessionAutofillLogins.length > 0)
    ? sessionAutofillLogins
    : [sessionAutofill];
  return logins
    .map(normalizeSessionLogin)
    .filter(Boolean)
    .filter((login) => loginMatchesPage(login, pageUrl, host, equivalentDomainGroups, subdomainMatchingEnabled));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "GV_FORMS_DETECTED") {
      const sessionState = await chrome.storage.session.get(["sessionAutofill", "sessionAutofillLogins"]);
      const { gvEquivalentDomains, gvSubdomainMatchingEnabled } = await chrome.storage.sync.get({ gvEquivalentDomains: [], gvSubdomainMatchingEnabled: true });
      const host = hostFromUrl(message.url);
      const matches = matchingSessionLogins(sessionState, message.url, host, gvEquivalentDomains, gvSubdomainMatchingEnabled !== false);
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
              url: message.url || "",
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
        url: tab?.url,
        username: message.username,
        password: message.password,
        matchMode: message.matchMode,
        matchUrl: message.matchUrl,
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
      const login = normalizeSessionLogin({ host: pendingFillChoices?.host, url: pendingFillChoices?.url, ...choice });
      if (!Number.isInteger(choiceIndex) || !login || !pendingFillChoices?.tabId) {
        sendResponse({ ok: false, error: "Selected login is no longer available." });
        return;
      }
      const tab = await chrome.tabs.get(pendingFillChoices.tabId);
      const pageHost = hostFromUrl(tab?.url);
      if (!await autofillEnabled() || await domainDisabled(pageHost)) {
        await chrome.storage.session.remove("pendingFillChoices");
        sendResponse({ ok: false, error: "Autofill is disabled for this site." });
        return;
      }
      const { gvEquivalentDomains, gvSubdomainMatchingEnabled } = await chrome.storage.sync.get({ gvEquivalentDomains: [], gvSubdomainMatchingEnabled: true });
      if (!loginMatchesPage(login, tab?.url, pageHost, gvEquivalentDomains, gvSubdomainMatchingEnabled !== false)) {
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
      const { gvEquivalentDomains, gvSubdomainMatchingEnabled } = await chrome.storage.sync.get({ gvEquivalentDomains: [], gvSubdomainMatchingEnabled: true });
      const knownLogin = matchingSessionLogins({ sessionAutofill, sessionAutofillLogins }, message.url, host, gvEquivalentDomains, gvSubdomainMatchingEnabled !== false)
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

    if (message?.type === "GV_FILL_GENERATED_PASSWORD") {
      const tab = await activeTab();
      if (!tab?.id) {
        sendResponse({ ok: false, filled: 0, error: "No active tab." });
        return;
      }
      if (!message.password) {
        sendResponse({ ok: false, filled: 0, error: "Generate a password first." });
        return;
      }
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: "GV_FILL_GENERATED_PASSWORD",
        password: message.password,
      });
      const filled = Number(result?.filled) || 0;
      sendResponse(filled > 0
        ? { ok: true, filled }
        : { ok: false, filled: 0, error: "Click directly in a visible password field on the page first, then try again." });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message." });
  })().catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
