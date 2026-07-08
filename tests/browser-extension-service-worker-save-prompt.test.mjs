import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const serviceWorkerScript = await readFile("apps/browser-extension/src/service-worker.js", "utf8");

test("service worker stores pending save-new-login prompt without pretending to save vault data", async () => {
  const sessionStore = { pendingUpdateLogin: { username: "stale@example.test", password: "old-stale" } };
  const messages = [];
  const context = serviceWorkerContext({ sessionStore, messages });
  vm.runInNewContext(serviceWorkerScript, context);
  const listener = messages[0];

  const response = await sendMessage(listener, {
    type: "GV_LOGIN_SUBMITTED",
    username: "new-login@example.test",
    password: "captured-password",
    url: "https://example.test/login",
    host: "example.test"
  }, { tab: { id: 7 } });

  assert.equal(response.ok, true);
  assert.equal(sessionStore.pendingSaveLogin.username, "new-login@example.test");
  assert.equal(sessionStore.pendingSaveLogin.password, "captured-password");
  assert.equal(sessionStore.pendingSaveLogin.host, "example.test");
  assert.equal(sessionStore.pendingSaveLogin.url, "https://example.test/login");
  assert.equal(sessionStore.pendingSaveLogin.tabId, 7);
  assert.match(sessionStore.pendingSaveLogin.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(sessionStore.pendingUpdateLogin, undefined, "new login prompts should clear stale update prompts");
});

test("service worker can dismiss a pending save-new-login prompt", async () => {
  const sessionStore = { pendingSaveLogin: { username: "person@example.test" } };
  const messages = [];
  const context = serviceWorkerContext({ sessionStore, messages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], { type: "GV_DISMISS_SAVE_LOGIN" }, {});

  assert.equal(response.ok, true);
  assert.equal(sessionStore.pendingSaveLogin, undefined);
});

test("service worker stores an update-password prompt for a changed known session login", async () => {
  const sessionStore = {
    sessionAutofill: {
      host: "example.test",
      username: "person@example.test",
      password: "old-password",
      at: "2026-07-01T00:00:00.000Z"
    }
  };
  const messages = [];
  const context = serviceWorkerContext({ sessionStore, messages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], {
    type: "GV_LOGIN_SUBMITTED",
    username: "person@example.test",
    password: "new-password",
    url: "https://example.test/login",
    host: "example.test"
  }, { tab: { id: 11 } });

  assert.equal(response.ok, true);
  assert.equal(sessionStore.pendingSaveLogin, undefined, "known changed logins should not be treated as new logins");
  assert.equal(sessionStore.pendingUpdateLogin.username, "person@example.test");
  assert.equal(sessionStore.pendingUpdateLogin.oldPassword, "old-password");
  assert.equal(sessionStore.pendingUpdateLogin.password, "new-password");
  assert.equal(sessionStore.pendingUpdateLogin.host, "example.test");
  assert.equal(sessionStore.pendingUpdateLogin.url, "https://example.test/login");
  assert.equal(sessionStore.pendingUpdateLogin.tabId, 11);
});

test("service worker normalizes submitted www hosts before choosing save or update prompt", async () => {
  const sessionStore = {
    sessionAutofill: {
      host: "example.test",
      username: "person@example.test",
      password: "old-password",
      at: "2026-07-01T00:00:00.000Z"
    }
  };
  const messages = [];
  const context = serviceWorkerContext({ sessionStore, messages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], {
    type: "GV_LOGIN_SUBMITTED",
    username: "person@example.test",
    password: "new-password",
    url: "https://www.example.test/login",
    host: "www.example.test"
  }, { tab: { id: 13 } });

  assert.equal(response.ok, true);
  assert.equal(sessionStore.pendingSaveLogin, undefined, "www host variants for known logins must not create new-login prompts");
  assert.equal(sessionStore.pendingUpdateLogin.username, "person@example.test");
  assert.equal(sessionStore.pendingUpdateLogin.host, "example.test");
  assert.equal(sessionStore.pendingUpdateLogin.password, "new-password");
});

test("service worker suppresses save-new-login prompts when autosave setting is disabled", async () => {
  const sessionStore = {
    pendingSaveLogin: { username: "stale-save@example.test", password: "stale" },
    pendingUpdateLogin: { username: "stale-update@example.test", password: "stale" }
  };
  const syncStore = { gvAutosaveEnabled: false };
  const messages = [];
  const context = serviceWorkerContext({ sessionStore, syncStore, messages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], {
    type: "GV_LOGIN_SUBMITTED",
    username: "new-login@example.test",
    password: "captured-password",
    url: "https://example.test/login",
    host: "example.test"
  }, { tab: { id: 15 } });

  assert.equal(response.ok, true);
  assert.equal(sessionStore.pendingSaveLogin, undefined, "disabled autosave must not leave a save-new-login prompt");
  assert.equal(sessionStore.pendingUpdateLogin, undefined, "disabled autosave must clear stale update prompts too");
});

test("service worker suppresses update-password prompts when autosave setting is disabled", async () => {
  const sessionStore = {
    sessionAutofill: {
      host: "example.test",
      username: "person@example.test",
      password: "old-password",
      at: "2026-07-01T00:00:00.000Z"
    }
  };
  const syncStore = { gvAutosaveEnabled: false };
  const messages = [];
  const context = serviceWorkerContext({ sessionStore, syncStore, messages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], {
    type: "GV_LOGIN_SUBMITTED",
    username: "person@example.test",
    password: "new-password",
    url: "https://example.test/login",
    host: "example.test"
  }, { tab: { id: 16 } });

  assert.equal(response.ok, true);
  assert.equal(sessionStore.pendingSaveLogin, undefined);
  assert.equal(sessionStore.pendingUpdateLogin, undefined, "disabled autosave must not create update-password prompts");
});

test("service worker autofills a matching session login when autofill is enabled by default", async () => {
  const sessionStore = {
    sessionAutofill: {
      host: "example.test",
      username: "person@example.test",
      password: "session-password",
      at: "2026-07-01T00:00:00.000Z"
    }
  };
  const messages = [];
  const tabMessages = [];
  const context = serviceWorkerContext({ sessionStore, messages, tabMessages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], {
    type: "GV_FORMS_DETECTED",
    count: 1,
    url: "https://example.test/login",
    host: "example.test"
  }, { tab: { id: 21 } });

  assert.equal(response.ok, true);
  assert.equal(tabMessages.length, 1);
  assert.equal(tabMessages[0].tabId, 21);
  assert.equal(tabMessages[0].message.type, "GV_FILL_LOGIN");
  assert.equal(tabMessages[0].message.username, "person@example.test");
  assert.equal(tabMessages[0].message.password, "session-password");
});

test("service worker stores multiple session logins for the same host", async () => {
  const sessionStore = {};
  const messages = [];
  const context = serviceWorkerContext({ sessionStore, messages });
  vm.runInNewContext(serviceWorkerScript, context);

  let response = await sendMessage(messages[0], {
    type: "GV_SAVE_SESSION_LOGIN",
    username: "primary@example.test",
    password: "primary-password"
  }, {});
  assert.equal(response.ok, true);

  response = await sendMessage(messages[0], {
    type: "GV_SAVE_SESSION_LOGIN",
    username: "admin@example.test",
    password: "admin-password"
  }, {});

  assert.equal(response.ok, true);
  assert.equal(sessionStore.sessionAutofill.host, "example.test", "legacy single session autofill record should remain for compatibility");
  assert.equal(sessionStore.sessionAutofill.username, "admin@example.test", "legacy single record should track the most recent saved login");
  assert.equal(sessionStore.sessionAutofillLogins.length, 2);
  assert.equal(sessionStore.sessionAutofillLogins[0].username, "primary@example.test");
  assert.equal(sessionStore.sessionAutofillLogins[1].username, "admin@example.test");
});

test("service worker opens a chooser instead of autofilling when multiple session logins match", async () => {
  const sessionStore = {
    sessionAutofillLogins: [
      { host: "example.test", username: "primary@example.test", password: "primary-password", at: "2026-07-01T00:00:00.000Z" },
      { host: "example.test", username: "admin@example.test", password: "admin-password", at: "2026-07-01T00:01:00.000Z" }
    ]
  };
  const messages = [];
  const tabMessages = [];
  const context = serviceWorkerContext({ sessionStore, messages, tabMessages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], {
    type: "GV_FORMS_DETECTED",
    count: 1,
    url: "https://example.test/login",
    host: "example.test"
  }, { tab: { id: 31 } });

  assert.equal(response.ok, true);
  assert.equal(tabMessages.length, 0, "multiple matching logins must not auto-send credentials to the content script");
  assert.equal(sessionStore.pendingFillChoices.host, "example.test");
  assert.equal(sessionStore.pendingFillChoices.tabId, 31);
  assert.deepEqual(sessionStore.pendingFillChoices.choices.map((choice) => choice.username), ["primary@example.test", "admin@example.test"]);
});

test("service worker fills the selected multiple-match choice in the original tab", async () => {
  const sessionStore = {
    pendingFillChoices: {
      host: "example.test",
      tabId: 37,
      choices: [
        { username: "primary@example.test", password: "primary-password" },
        { username: "admin@example.test", password: "admin-password" }
      ]
    }
  };
  const messages = [];
  const tabMessages = [];
  const context = serviceWorkerContext({ sessionStore, messages, tabMessages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], { type: "GV_FILL_CHOICE", choiceIndex: 1 }, {});

  assert.equal(response.ok, true);
  assert.equal(tabMessages.length, 1);
  assert.equal(tabMessages[0].tabId, 37, "selected choice should fill the page tab that produced the match prompt");
  assert.equal(tabMessages[0].message.username, "admin@example.test");
  assert.equal(tabMessages[0].message.password, "admin-password");
  assert.equal(sessionStore.pendingFillChoices, undefined, "successful selected fill should clear the chooser prompt");
});

test("service worker refuses a selected multiple-match choice after the original tab navigates to another host", async () => {
  const sessionStore = {
    pendingFillChoices: {
      host: "example.test",
      tabId: 37,
      choices: [
        { username: "victim@example.test", password: "secret-password" }
      ]
    }
  };
  const messages = [];
  const tabMessages = [];
  const context = serviceWorkerContext({
    sessionStore,
    messages,
    tabMessages,
    tabUrls: { 37: "https://attacker.test/login" }
  });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], { type: "GV_FILL_CHOICE", choiceIndex: 0 }, {});

  assert.equal(response.ok, false);
  assert.match(response.error, /no longer available|page changed/i);
  assert.equal(tabMessages.length, 0, "stale chooser choices must not send credentials to a navigated tab");
  assert.equal(sessionStore.pendingFillChoices, undefined, "stale chooser choices should be cleared after refusal");
});

test("service worker refuses a selected multiple-match choice when autofill is disabled after chooser staging", async () => {
  const sessionStore = {
    pendingFillChoices: {
      host: "example.test",
      tabId: 37,
      choices: [
        { username: "victim@example.test", password: "secret-password" }
      ]
    }
  };
  const syncStore = { gvAutofillEnabled: false };
  const messages = [];
  const tabMessages = [];
  const context = serviceWorkerContext({ sessionStore, syncStore, messages, tabMessages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], { type: "GV_FILL_CHOICE", choiceIndex: 0 }, {});

  assert.equal(response.ok, false);
  assert.match(response.error, /disabled/i);
  assert.equal(tabMessages.length, 0, "disabled autofill must not send chooser credentials to the content script");
  assert.equal(sessionStore.pendingFillChoices, undefined, "disabled autofill should clear stale chooser state");
});

test("service worker refuses a selected multiple-match choice when the chooser host becomes disabled", async () => {
  const sessionStore = {
    pendingFillChoices: {
      host: "example.test",
      tabId: 37,
      choices: [
        { username: "victim@example.test", password: "secret-password" }
      ]
    }
  };
  const syncStore = { gvDisabledDomains: ["example.test"] };
  const messages = [];
  const tabMessages = [];
  const context = serviceWorkerContext({ sessionStore, syncStore, messages, tabMessages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], { type: "GV_FILL_CHOICE", choiceIndex: 0 }, {});

  assert.equal(response.ok, false);
  assert.match(response.error, /disabled/i);
  assert.equal(tabMessages.length, 0, "domain-disabled autofill must not send chooser credentials to the content script");
  assert.equal(sessionStore.pendingFillChoices, undefined, "domain-disabled autofill should clear stale chooser state");
});

test("service worker suppresses fill prompt state without blocking automatic session autofill", async () => {
  const sessionStore = {
    lastDetectedForms: { count: 1, host: "stale.test" },
    sessionAutofill: {
      host: "example.test",
      username: "person@example.test",
      password: "session-password",
      at: "2026-07-01T00:00:00.000Z"
    }
  };
  const syncStore = { gvFillPromptEnabled: false };
  const messages = [];
  const tabMessages = [];
  const context = serviceWorkerContext({ sessionStore, syncStore, messages, tabMessages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], {
    type: "GV_FORMS_DETECTED",
    count: 1,
    url: "https://example.test/login",
    host: "example.test"
  }, { tab: { id: 22 } });

  assert.equal(response.ok, true);
  assert.equal(sessionStore.lastDetectedForms, undefined, "disabled fill prompts must clear and not store form-detection prompt state");
  assert.equal(tabMessages.length, 1, "fill prompt setting must not disable automatic session autofill");
  assert.equal(tabMessages[0].message.type, "GV_FILL_LOGIN");
  assert.equal(tabMessages[0].message.username, "person@example.test");
  assert.equal(tabMessages[0].message.password, "session-password");
});

test("service worker suppresses matching session autofill when autofill setting is disabled", async () => {
  const sessionStore = {
    sessionAutofill: {
      host: "example.test",
      username: "person@example.test",
      password: "session-password",
      at: "2026-07-01T00:00:00.000Z"
    }
  };
  const syncStore = { gvAutofillEnabled: false };
  const messages = [];
  const tabMessages = [];
  const context = serviceWorkerContext({ sessionStore, syncStore, messages, tabMessages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], {
    type: "GV_FORMS_DETECTED",
    count: 1,
    url: "https://example.test/login",
    host: "example.test"
  }, { tab: { id: 22 } });

  assert.equal(response.ok, true);
  assert.equal(tabMessages.length, 0, "disabled autofill must not send credentials to the content script");
  assert.equal(sessionStore.lastDetectedForms.host, "example.test", "form detection status should still be recorded");
});

test("service worker suppresses matching session autofill for domains in the disabled list", async () => {
  const sessionStore = {
    sessionAutofill: {
      host: "example.test",
      username: "person@example.test",
      password: "session-password",
      at: "2026-07-01T00:00:00.000Z"
    }
  };
  const syncStore = { gvDisabledDomains: ["example.test"] };
  const messages = [];
  const tabMessages = [];
  const context = serviceWorkerContext({ sessionStore, syncStore, messages, tabMessages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], {
    type: "GV_FORMS_DETECTED",
    count: 1,
    url: "https://www.example.test/login",
    host: "www.example.test"
  }, { tab: { id: 23 } });

  assert.equal(response.ok, true);
  assert.equal(tabMessages.length, 0, "domain-disabled autofill must not send credentials to the content script");
  assert.equal(sessionStore.lastDetectedForms.host, "www.example.test", "form detection status should still be recorded");
});

test("service worker suppresses save-new-login prompts for domains in the disabled list", async () => {
  const sessionStore = {
    pendingSaveLogin: { username: "stale-save@example.test", password: "stale" },
    pendingUpdateLogin: { username: "stale-update@example.test", password: "stale" }
  };
  const syncStore = { gvDisabledDomains: ["example.test"] };
  const messages = [];
  const context = serviceWorkerContext({ sessionStore, syncStore, messages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], {
    type: "GV_LOGIN_SUBMITTED",
    username: "new-login@example.test",
    password: "captured-password",
    url: "https://example.test/login",
    host: "example.test"
  }, { tab: { id: 24 } });

  assert.equal(response.ok, true);
  assert.equal(sessionStore.pendingSaveLogin, undefined, "domain-disabled autosave must not leave a save-new-login prompt");
  assert.equal(sessionStore.pendingUpdateLogin, undefined, "domain-disabled autosave must clear stale update prompts too");
});

test("service worker suppresses update-password prompts for domains in the disabled list", async () => {
  const sessionStore = {
    sessionAutofill: {
      host: "example.test",
      username: "person@example.test",
      password: "old-password",
      at: "2026-07-01T00:00:00.000Z"
    }
  };
  const syncStore = { gvDisabledDomains: ["example.test"] };
  const messages = [];
  const context = serviceWorkerContext({ sessionStore, syncStore, messages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], {
    type: "GV_LOGIN_SUBMITTED",
    username: "person@example.test",
    password: "new-password",
    url: "https://example.test/login",
    host: "example.test"
  }, { tab: { id: 25 } });

  assert.equal(response.ok, true);
  assert.equal(sessionStore.pendingSaveLogin, undefined);
  assert.equal(sessionStore.pendingUpdateLogin, undefined, "domain-disabled autosave must not create update-password prompts");
});

test("service worker still allows manual active-tab fill when autofill setting is disabled", async () => {
  const syncStore = { gvAutofillEnabled: false };
  const messages = [];
  const tabMessages = [];
  const context = serviceWorkerContext({ syncStore, messages, tabMessages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], {
    type: "GV_FILL_ACTIVE_TAB",
    username: "manual@example.test",
    password: "manual-password"
  }, {});

  assert.equal(response.ok, true);
  assert.equal(tabMessages.length, 1);
  assert.equal(tabMessages[0].tabId, 7);
  assert.equal(tabMessages[0].message.type, "GV_FILL_LOGIN");
  assert.equal(tabMessages[0].message.username, "manual@example.test");
  assert.equal(tabMessages[0].message.password, "manual-password");
});

test("service worker ignores unchanged known session login submissions", async () => {
  const sessionStore = {
    sessionAutofill: {
      host: "example.test",
      username: "person@example.test",
      password: "same-password",
      at: "2026-07-01T00:00:00.000Z"
    },
    pendingUpdateLogin: { username: "person@example.test", password: "stale-password" }
  };
  const messages = [];
  const context = serviceWorkerContext({ sessionStore, messages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], {
    type: "GV_LOGIN_SUBMITTED",
    username: "person@example.test",
    password: "same-password",
    url: "https://example.test/login",
    host: "example.test"
  }, { tab: { id: 12 } });

  assert.equal(response.ok, true);
  assert.equal(sessionStore.pendingSaveLogin, undefined);
  assert.equal(sessionStore.pendingUpdateLogin, undefined, "unchanged known logins should clear stale update prompts");
});

test("service worker can dismiss a pending update-password prompt", async () => {
  const sessionStore = { pendingUpdateLogin: { username: "person@example.test" } };
  const messages = [];
  const context = serviceWorkerContext({ sessionStore, messages });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(messages[0], { type: "GV_DISMISS_UPDATE_LOGIN" }, {});

  assert.equal(response.ok, true);
  assert.equal(sessionStore.pendingUpdateLogin, undefined);
});

async function sendMessage(listener, message, sender) {
  return await new Promise((resolve) => {
    listener(message, sender, resolve);
  });
}

function serviceWorkerContext({ sessionStore = {}, syncStore = {}, messages = [], tabMessages = [], tabUrls = {} } = {}) {
  return {
    URL,
    Date,
    console,
    chrome: {
      tabs: {
        query: async () => [{ id: 7, url: "https://example.test/login" }],
        get: async (tabId) => ({ id: tabId, url: tabUrls[tabId] || "https://example.test/login" }),
        sendMessage: async (tabId, message) => {
          tabMessages.push({ tabId, message });
          return { filled: 1 };
        }
      },
      storage: {
        session: storageArea(sessionStore),
        sync: storageArea(syncStore)
      },
      runtime: {
        onMessage: {
          addListener(listener) { messages.push(listener); }
        }
      }
    }
  };
}

function storageArea(store) {
  return {
    get: async (key) => {
      if (typeof key === "string") return { [key]: store[key] };
      if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, store[item]]));
      if (key && typeof key === "object") {
        return Object.fromEntries(Object.entries(key).map(([item, fallback]) => [item, store[item] ?? fallback]));
      }
      return { ...store };
    },
    set: async (value) => Object.assign(store, value),
    remove: async (key) => { delete store[key]; }
  };
}
