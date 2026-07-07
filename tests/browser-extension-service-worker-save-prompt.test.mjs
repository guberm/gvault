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

function serviceWorkerContext({ sessionStore = {}, syncStore = {}, messages = [] } = {}) {
  return {
    URL,
    Date,
    console,
    chrome: {
      tabs: {
        query: async () => [{ id: 7, url: "https://example.test/login" }],
        sendMessage: async () => ({ filled: 1 })
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
