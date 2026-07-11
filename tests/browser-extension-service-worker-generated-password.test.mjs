import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const serviceWorkerScript = await readFile("apps/browser-extension/src/service-worker.js", "utf8");

test("service worker forwards a generated password to the active tab without persisting it", async () => {
  const sessionStore = {};
  const syncStore = {};
  const listeners = [];
  const tabMessages = [];
  const tabQueries = [];
  const context = serviceWorkerContext({ sessionStore, syncStore, listeners, tabMessages, tabQueries, fillResponse: { filled: 1 } });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(listeners[0], { type: "GV_FILL_GENERATED_PASSWORD", password: "transient-generated-value" });

  assert.deepEqual({ ...response }, { ok: true, filled: 1 });
  assert.deepEqual(tabQueries.map((query) => ({ ...query })), [{ active: true, currentWindow: true }]);
  assert.equal(tabMessages.length, 1);
  assert.equal(tabMessages[0].tabId, 7);
  assert.deepEqual({ ...tabMessages[0].message }, { type: "GV_FILL_GENERATED_PASSWORD", password: "transient-generated-value" });
  assert.equal(JSON.stringify(sessionStore).includes("transient-generated-value"), false);
  assert.equal(JSON.stringify(syncStore).includes("transient-generated-value"), false);
});

test("service worker reports when the active tab has no eligible password field", async () => {
  const listeners = [];
  const context = serviceWorkerContext({ listeners, fillResponse: { filled: 0 } });
  vm.runInNewContext(serviceWorkerScript, context);

  const response = await sendMessage(listeners[0], { type: "GV_FILL_GENERATED_PASSWORD", password: "transient-generated-value" });

  assert.deepEqual({ ...response }, { ok: false, filled: 0, error: "Click directly in a visible password field on the page first, then try again." });
});

async function sendMessage(listener, message) {
  return new Promise((resolve) => listener(message, {}, resolve));
}

function serviceWorkerContext({ sessionStore = {}, syncStore = {}, listeners = [], tabMessages = [], tabQueries = [], fillResponse = { filled: 1 } } = {}) {
  return {
    URL,
    Date,
    console,
    chrome: {
      tabs: {
        query: async (query) => { tabQueries.push(query); return [{ id: 7, url: "https://example.test/register" }]; },
        get: async (tabId) => ({ id: tabId, url: "https://example.test/register" }),
        sendMessage: async (tabId, message) => { tabMessages.push({ tabId, message }); return fillResponse; }
      },
      storage: { session: storageArea(sessionStore), sync: storageArea(syncStore) },
      runtime: { onMessage: { addListener(listener) { listeners.push(listener); } } }
    }
  };
}

function storageArea(store) {
  return {
    get: async (key) => {
      if (typeof key === "string") return { [key]: store[key] };
      if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, store[item]]));
      if (key && typeof key === "object") return Object.fromEntries(Object.entries(key).map(([item, fallback]) => [item, store[item] ?? fallback]));
      return { ...store };
    },
    set: async (value) => Object.assign(store, value),
    remove: async (keys) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key]; }
  };
}
