import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const popupHtml = await readFile("apps/browser-extension/src/popup.html", "utf8");
const popupScript = await readFile("apps/browser-extension/src/popup.js", "utf8");
const optionsHtml = await readFile("apps/browser-extension/src/options.html", "utf8");
const optionsScript = await readFile("apps/browser-extension/src/options.js", "utf8");

test("browser extension popup reports identity/address detection from content script", async () => {
  const statusText = await renderPopupStatus({
    count: 0,
    identityAddressCount: 2,
    identityAddressTypes: ["identity", "address"],
    url: "https://example.test/profile",
    host: "example.test"
  }, "identity/address");
  assert.equal(statusText, "2 identity/address forms detected on this page.");
});

test("browser extension popup reports payment-card detection from content script", async () => {
  const statusText = await renderPopupStatus({
    count: 0,
    identityAddressCount: 0,
    paymentCardCount: 1,
    paymentCardTypes: ["paymentCard"],
    url: "https://example.test/pay",
    host: "example.test"
  }, "payment-card");
  assert.equal(statusText, "1 payment-card form detected on this page.");
});

test("browser extension popup reports clear no-form status after a zero-count scan", async () => {
  const statusText = await renderPopupStatus({
    count: 0,
    identityAddressCount: 0,
    paymentCardCount: 0,
    url: "https://example.test/search",
    host: "example.test"
  }, "No login");
  assert.equal(statusText, "No login, identity/address, or payment-card form detected yet. You can still fill manually.");
});

test("browser extension popup reports no matching session login when login forms have no match", async () => {
  const statusText = await renderPopupStatus({
    count: 1,
    identityAddressCount: 0,
    paymentCardCount: 0,
    matchingLoginCount: 0,
    noMatchingLogin: true,
    url: "https://example.test/login",
    host: "example.test"
  }, "No matching login");
  assert.equal(statusText, "No matching login for 1 login form detected on this page. You can still fill manually.");
});

test("browser extension popup shows a save-new-login prompt from captured credentials", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  const sentMessages = [];
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__sentMessages = [];
      globalThis.__createdTabs = [];
      globalThis.__storageListeners = [];
      globalThis.chrome = {
        runtime: {
          sendMessage: async (message) => {
            globalThis.__sentMessages.push(message);
            return { ok: true };
          },
          openOptionsPage() {}
        },
        tabs: {
          create: async (payload) => {
            globalThis.__createdTabs.push(payload);
            return { id: 9, ...payload };
          }
        },
        storage: {
          onChanged: {
            addListener(listener) {
              globalThis.__storageListeners.push(listener);
            }
          },
          sync: {
            get: async () => ({ gvServerUrl: "https://gvault.guber.dev" }),
            set: async () => undefined
          },
          session: {
            get: async (key) => {
              if (key === "pendingSaveLogin") {
                return {
                  pendingSaveLogin: {
                    username: "new-login@example.test",
                    password: "captured-password",
                    url: "https://example.test/login",
                    host: "example.test"
                  }
                };
              }
              if (key === "pendingUpdateLogin") return { pendingUpdateLogin: undefined };
              return { lastDetectedForms: { count: 1, url: "https://example.test/login", host: "example.test" } };
            },
            set: async () => undefined
          }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });
    await page.waitForSelector("#savePrompt");
    assert.match(await page.locator("#savePrompt").textContent(), /Save login for example\.test/);
    assert.match(await page.locator("#savePrompt").textContent(), /new-login@example\.test/);

    await page.evaluate(() => {
      globalThis.__storageListeners[0]({
        pendingSaveLogin: {
          newValue: {
            username: "late-capture@example.test",
            password: "late-password",
            url: "https://late.example.test/login",
            host: "late.example.test"
          }
        }
      }, "session");
    });
    assert.match(await page.locator("#savePrompt").textContent(), /Save login for late\.example\.test/);
    assert.match(await page.locator("#savePrompt").textContent(), /late-capture@example\.test/);
    assert.equal(await page.locator("#username").inputValue(), "late-capture@example.test");
    assert.equal(await page.locator("#password").inputValue(), "late-password");

    await page.locator("#openWebVault").click();
    const createdTabs = await page.evaluate(() => globalThis.__createdTabs);
    assert.equal(createdTabs.at(-1).url, "https://gvault.guber.dev", "open-vault action uses configured server URL");
    assert.equal(createdTabs.at(-1).url.includes("captured-password"), false, "open-vault action must not leak captured password in URL");

    await page.locator("#dismissSaveLogin").click();
    sentMessages.push(...await page.evaluate(() => globalThis.__sentMessages));
    assert.deepEqual(sentMessages.at(-1), { type: "GV_DISMISS_SAVE_LOGIN" });
    assert.equal(await page.locator("#savePrompt").isVisible(), false);
  } finally {
    await browser.close();
  }
});

test("browser extension popup shows an update-password prompt from changed captured credentials", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__sentMessages = [];
      globalThis.chrome = {
        runtime: {
          sendMessage: async (message) => {
            globalThis.__sentMessages.push(message);
            return { ok: true };
          },
          openOptionsPage() {}
        },
        tabs: { create: async (payload) => ({ id: 9, ...payload }) },
        storage: {
          onChanged: { addListener() {} },
          sync: {
            get: async () => ({ gvServerUrl: "https://gvault.guber.dev" }),
            set: async () => undefined
          },
          session: {
            get: async (key) => {
              if (key === "pendingSaveLogin") return { pendingSaveLogin: undefined };
              if (key === "pendingUpdateLogin") {
                return {
                  pendingUpdateLogin: {
                    username: "person@example.test",
                    oldPassword: "old-password",
                    password: "changed-password",
                    url: "https://example.test/login",
                    host: "example.test"
                  }
                };
              }
              return { lastDetectedForms: { count: 1, url: "https://example.test/login", host: "example.test" } };
            },
            set: async () => undefined
          }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });
    await page.waitForSelector("#savePrompt");
    assert.equal(await page.locator("#savePrompt h2").textContent(), "Update password?");
    assert.equal(await page.locator("#openWebVault").textContent(), "Open web vault to update");
    assert.match(await page.locator("#savePrompt").textContent(), /Update password for example\.test/);
    assert.match(await page.locator("#savePrompt").textContent(), /person@example\.test/);
    assert.equal(await page.locator("#username").inputValue(), "person@example.test");
    assert.equal(await page.locator("#password").inputValue(), "changed-password");

    await page.locator("#dismissSaveLogin").click();
    const sentMessages = await page.evaluate(() => globalThis.__sentMessages);
    assert.deepEqual(sentMessages.at(-1), { type: "GV_DISMISS_UPDATE_LOGIN" });
    assert.equal(await page.locator("#savePrompt").isVisible(), false);
  } finally {
    await browser.close();
  }
});

test("browser extension popup keeps the fresh prompt visible when stale counterpart storage is removed", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__storageListeners = [];
      globalThis.chrome = {
        runtime: { sendMessage: async () => ({ ok: true }), openOptionsPage() {} },
        tabs: { create: async (payload) => ({ id: 9, ...payload }) },
        storage: {
          onChanged: { addListener(listener) { globalThis.__storageListeners.push(listener); } },
          sync: { get: async () => ({ gvServerUrl: "https://gvault.guber.dev" }), set: async () => undefined },
          session: {
            get: async (key) => {
              if (key === "pendingUpdateLogin") return { pendingUpdateLogin: undefined };
              if (key === "pendingSaveLogin") return { pendingSaveLogin: undefined };
              return { lastDetectedForms: { count: 0, url: "https://example.test/search", host: "example.test" } };
            },
            set: async () => undefined
          }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });
    await page.waitForFunction(() => globalThis.__storageListeners?.length === 1);

    await page.evaluate(() => {
      globalThis.__storageListeners[0]({
        pendingSaveLogin: {
          newValue: {
            username: "new@example.test",
            password: "new-password",
            url: "https://example.test/login",
            host: "example.test"
          }
        }
      }, "session");
    });
    assert.match(await page.locator("#savePrompt").textContent(), /Save login for example\.test/);
    assert.equal(await page.locator("#savePrompt").isVisible(), true);

    await page.evaluate(() => {
      globalThis.__storageListeners[0]({ pendingUpdateLogin: { oldValue: { username: "stale@example.test" } } }, "session");
    });
    assert.equal(await page.locator("#savePrompt").isVisible(), true, "removing a stale update prompt must not hide a fresh save prompt");
    assert.match(await page.locator("#savePrompt").textContent(), /Save login for example\.test/);

    await page.evaluate(() => {
      globalThis.__storageListeners[0]({
        pendingUpdateLogin: {
          newValue: {
            username: "person@example.test",
            oldPassword: "old-password",
            password: "changed-password",
            url: "https://example.test/login",
            host: "example.test"
          }
        }
      }, "session");
    });
    assert.match(await page.locator("#savePrompt").textContent(), /Update password for example\.test/);
    assert.equal(await page.locator("#savePrompt").isVisible(), true);

    await page.evaluate(() => {
      globalThis.__storageListeners[0]({ pendingSaveLogin: { oldValue: { username: "new@example.test" } } }, "session");
    });
    assert.equal(await page.locator("#savePrompt").isVisible(), true, "removing a stale save prompt must not hide a fresh update prompt");
    assert.match(await page.locator("#savePrompt").textContent(), /Update password for example\.test/);
  } finally {
    await browser.close();
  }
});

test("browser extension popup sends per-item URL match controls when saving session autofill", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__sentMessages = [];
      globalThis.chrome = {
        runtime: {
          sendMessage: async (message) => {
            globalThis.__sentMessages.push(message);
            return { ok: true };
          },
          openOptionsPage() {}
        },
        tabs: {
          create: async (payload) => ({ id: 9, ...payload }),
          query: async () => [{ id: 7, url: "https://example.test/admin/login" }]
        },
        storage: {
          onChanged: { addListener() {} },
          sync: { get: async () => ({ gvServerUrl: "https://gvault.guber.dev" }), set: async () => undefined },
          session: {
            get: async (key) => {
              if (key === "pendingUpdateLogin") return { pendingUpdateLogin: undefined };
              if (key === "pendingSaveLogin") return { pendingSaveLogin: undefined };
              if (key === "pendingFillChoices") return { pendingFillChoices: undefined };
              return { lastDetectedForms: { count: 1, url: "https://example.test/admin/login", host: "example.test" } };
            },
            set: async () => undefined,
            remove: async () => undefined
          }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });
    await page.waitForSelector("#sessionMatchMode");

    assert.match(await page.locator("body").textContent(), /Session URL match/);
    assert.match(await page.locator("body").textContent(), /Match URL or prefix/);

    await page.locator("#username").fill("admin@example.test");
    await page.locator("#password").fill("secret-password");
    await page.locator("#sessionAutofill").check();
    await page.locator("#sessionMatchMode").selectOption("url-prefix");
    await page.locator("#sessionMatchUrl").fill("https://example.test/admin/");
    await page.locator("#fill").click();

    const sentMessages = await page.evaluate(() => globalThis.__sentMessages);
    assert.deepEqual(sentMessages.at(0), {
      type: "GV_FILL_ACTIVE_TAB",
      username: "admin@example.test",
      password: "secret-password"
    });
    assert.deepEqual(sentMessages.at(1), {
      type: "GV_SAVE_SESSION_LOGIN",
      username: "admin@example.test",
      password: "secret-password",
      matchMode: "url-prefix",
      matchUrl: "https://example.test/admin/"
    });
  } finally {
    await browser.close();
  }
});

test("browser extension popup renders multiple matching login choices and fills the selected one", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__sentMessages = [];
      globalThis.chrome = {
        runtime: {
          sendMessage: async (message) => {
            globalThis.__sentMessages.push(message);
            return { ok: true };
          },
          openOptionsPage() {}
        },
        tabs: {
          create: async (payload) => ({ id: 9, ...payload }),
          query: async () => [{ id: 7, url: "https://example.test/login" }]
        },
        storage: {
          onChanged: { addListener() {} },
          sync: { get: async () => ({ gvServerUrl: "https://gvault.guber.dev" }), set: async () => undefined },
          session: {
            get: async (key) => {
              if (key === "pendingUpdateLogin") return { pendingUpdateLogin: undefined };
              if (key === "pendingSaveLogin") return { pendingSaveLogin: undefined };
              if (key === "pendingFillChoices") {
                return {
                  pendingFillChoices: {
                    host: "example.test",
                    tabId: 42,
                    choices: [
                      { username: "primary@example.test" },
                      { username: "admin@example.test" }
                    ]
                  }
                };
              }
              return { lastDetectedForms: { count: 1, url: "https://example.test/login", host: "example.test" } };
            },
            set: async () => undefined,
            remove: async () => undefined
          }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });
    await page.waitForSelector("#fillChoices:not([hidden])");

    assert.match(await page.locator("#fillChoices").textContent(), /Choose a login for example\.test/);
    assert.match(await page.locator("#fillChoices").textContent(), /primary@example\.test/);
    assert.match(await page.locator("#fillChoices").textContent(), /admin@example\.test/);

    await page.getByRole("button", { name: "admin@example.test" }).click();
    const sentMessages = await page.evaluate(() => globalThis.__sentMessages);
    assert.deepEqual(sentMessages.at(-1), { type: "GV_FILL_CHOICE", choiceIndex: 1 });
    assert.equal(await page.locator("#fillChoices").isVisible(), false);
    assert.equal(await page.locator("#status").textContent(), "Filled selected login.");
  } finally {
    await browser.close();
  }
});

test("browser extension popup exposes and persists the autofill setting", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__syncStore = { gvServerUrl: "https://gvault.guber.dev", gvAutofillEnabled: false };
      globalThis.chrome = {
        runtime: { sendMessage: async () => ({ ok: true }), openOptionsPage() {} },
        tabs: { create: async (payload) => ({ id: 9, ...payload }) },
        storage: {
          onChanged: { addListener() {} },
          sync: {
            get: async (key) => {
              if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, globalThis.__syncStore[item]]));
              if (typeof key === "string") return { [key]: globalThis.__syncStore[key] };
              return { ...globalThis.__syncStore };
            },
            set: async (value) => { Object.assign(globalThis.__syncStore, value); }
          },
          session: { get: async () => ({ lastDetectedForms: { count: 0 } }), set: async () => undefined }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });
    await page.waitForSelector("#autofillEnabled");

    assert.equal(await page.locator("#autofillEnabled").isChecked(), false, "stored disabled autofill setting should render unchecked");
    assert.match(await page.locator("body").textContent(), /Automatically fill matching session logins/);

    await page.locator("#autofillEnabled").check();
    const syncStore = await page.evaluate(() => globalThis.__syncStore);
    assert.equal(syncStore.gvAutofillEnabled, true, "popup should persist autofill setting changes");
  } finally {
    await browser.close();
  }
});

test("browser extension popup exposes and persists the fill prompt setting", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__syncStore = { gvServerUrl: "https://gvault.guber.dev", gvFillPromptEnabled: false };
      globalThis.chrome = {
        runtime: { sendMessage: async () => ({ ok: true }), openOptionsPage() {} },
        tabs: { create: async (payload) => ({ id: 9, ...payload }) },
        storage: {
          onChanged: { addListener() {} },
          sync: {
            get: async (key) => {
              if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, globalThis.__syncStore[item]]));
              if (typeof key === "string") return { [key]: globalThis.__syncStore[key] };
              return { ...globalThis.__syncStore };
            },
            set: async (value) => { Object.assign(globalThis.__syncStore, value); }
          },
          session: { get: async () => ({ lastDetectedForms: { count: 0 } }), set: async () => undefined }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });
    await page.waitForSelector("#fillPromptEnabled");

    assert.equal(await page.locator("#fillPromptEnabled").isChecked(), false, "stored disabled fill prompt setting should render unchecked");
    assert.match(await page.locator("body").textContent(), /Show fill prompts for matching logins/);

    await page.locator("#fillPromptEnabled").check();
    const syncStore = await page.evaluate(() => globalThis.__syncStore);
    assert.equal(syncStore.gvFillPromptEnabled, true, "popup should persist fill prompt setting changes");
  } finally {
    await browser.close();
  }
});

test("browser extension popup exposes and persists the autosave setting", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__syncStore = { gvServerUrl: "https://gvault.guber.dev", gvAutosaveEnabled: false };
      globalThis.chrome = {
        runtime: { sendMessage: async () => ({ ok: true }), openOptionsPage() {} },
        tabs: { create: async (payload) => ({ id: 9, ...payload }) },
        storage: {
          onChanged: { addListener() {} },
          sync: {
            get: async (key) => {
              if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, globalThis.__syncStore[item]]));
              if (typeof key === "string") return { [key]: globalThis.__syncStore[key] };
              return { ...globalThis.__syncStore };
            },
            set: async (value) => { Object.assign(globalThis.__syncStore, value); }
          },
          session: { get: async () => ({ lastDetectedForms: { count: 0 } }), set: async () => undefined }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });
    await page.waitForSelector("#autosaveEnabled");

    assert.equal(await page.locator("#autosaveEnabled").isChecked(), false, "stored disabled setting should render unchecked");
    assert.match(await page.locator("body").textContent(), /Prompt to save or update submitted logins/);

    await page.locator("#autosaveEnabled").check();
    const syncStore = await page.evaluate(() => globalThis.__syncStore);
    assert.equal(syncStore.gvAutosaveEnabled, true, "popup should persist autosave setting changes");
  } finally {
    await browser.close();
  }
});

test("browser extension popup clears visible save/update prompts when autosave is disabled", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__syncStore = { gvServerUrl: "https://gvault.guber.dev", gvAutosaveEnabled: true };
      globalThis.__sessionStore = {
        pendingSaveLogin: {
          username: "new-login@example.test",
          password: "captured-password",
          url: "https://example.test/login",
          host: "example.test"
        }
      };
      globalThis.chrome = {
        runtime: { sendMessage: async () => ({ ok: true }), openOptionsPage() {} },
        tabs: { create: async (payload) => ({ id: 9, ...payload }) },
        storage: {
          onChanged: { addListener() {} },
          sync: {
            get: async (key) => {
              if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, globalThis.__syncStore[item]]));
              if (typeof key === "string") return { [key]: globalThis.__syncStore[key] };
              return { ...globalThis.__syncStore };
            },
            set: async (value) => { Object.assign(globalThis.__syncStore, value); }
          },
          session: {
            get: async (key) => {
              if (typeof key === "string") return { [key]: globalThis.__sessionStore[key] };
              return { ...globalThis.__sessionStore, lastDetectedForms: { count: 1 } };
            },
            set: async (value) => { Object.assign(globalThis.__sessionStore, value); },
            remove: async (key) => {
              const keys = Array.isArray(key) ? key : [key];
              for (const item of keys) delete globalThis.__sessionStore[item];
            }
          }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });
    await page.waitForSelector("#savePrompt:not([hidden])");
    assert.match(await page.locator("#savePrompt").textContent(), /Save login for example\.test/);

    await page.locator("#autosaveEnabled").uncheck();

    assert.equal(await page.locator("#savePrompt").isVisible(), false, "disabling autosave should hide the current prompt immediately");
    const stores = await page.evaluate(() => ({ sync: globalThis.__syncStore, session: globalThis.__sessionStore }));
    assert.equal(stores.sync.gvAutosaveEnabled, false, "disabled autosave setting should persist");
    assert.equal(stores.session.pendingSaveLogin, undefined, "disabling autosave should clear pending save prompts");
    assert.equal(stores.session.pendingUpdateLogin, undefined, "disabling autosave should clear pending update prompts");
  } finally {
    await browser.close();
  }
});

test("browser extension popup exposes and persists per-domain disablement for the current active tab", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__syncStore = { gvServerUrl: "https://gvault.guber.dev", gvDisabledDomains: ["active.test"] };
      globalThis.chrome = {
        runtime: { sendMessage: async () => ({ ok: true }), openOptionsPage() {} },
        tabs: {
          create: async (payload) => ({ id: 9, ...payload }),
          query: async () => [{ id: 7, url: "https://www.active.test/login" }]
        },
        storage: {
          onChanged: { addListener() {} },
          sync: {
            get: async (key) => {
              if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, globalThis.__syncStore[item]]));
              if (typeof key === "string") return { [key]: globalThis.__syncStore[key] };
              if (key && typeof key === "object") return Object.fromEntries(Object.entries(key).map(([item, fallback]) => [item, globalThis.__syncStore[item] ?? fallback]));
              return { ...globalThis.__syncStore };
            },
            set: async (value) => { Object.assign(globalThis.__syncStore, value); }
          },
          session: {
            get: async (key) => {
              if (key === "lastDetectedForms") return { lastDetectedForms: { count: 1, url: "https://stale.test/login", host: "stale.test" } };
              return { [key]: undefined };
            },
            set: async () => undefined,
            remove: async () => undefined
          }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });
    await page.waitForSelector("#domainDisabled");

    assert.equal(await page.locator("#domainDisabled").isChecked(), true, "stored disabled domain should render checked for the active tab, not stale detection state");
    assert.match(await page.locator("#domainDisabledLabel").textContent(), /active\.test/);
    assert.doesNotMatch(await page.locator("#domainDisabledLabel").textContent(), /stale\.test/);

    await page.locator("#domainDisabled").uncheck();
    let syncStore = await page.evaluate(() => globalThis.__syncStore);
    assert.deepEqual(syncStore.gvDisabledDomains, [], "unchecking should remove the active-tab normalized domain");

    await page.locator("#domainDisabled").check();
    syncStore = await page.evaluate(() => globalThis.__syncStore);
    assert.deepEqual(syncStore.gvDisabledDomains, ["active.test"], "checking should add the active-tab normalized domain once");
  } finally {
    await browser.close();
  }
});

test("browser extension options expose and persist autofill/autosave settings", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(optionsHtml.replace('<script src="options.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__syncStore = {
        gvServerUrl: "https://gvault.guber.dev",
        gvAutofillEnabled: false,
        gvFillPromptEnabled: false,
        gvAutosaveEnabled: true
      };
      globalThis.chrome = {
        storage: {
          sync: {
            get: async (key) => {
              if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, globalThis.__syncStore[item]]));
              if (typeof key === "string") return { [key]: globalThis.__syncStore[key] };
              return { ...globalThis.__syncStore };
            },
            set: async (value) => { Object.assign(globalThis.__syncStore, value); }
          }
        }
      };
    });
    await page.addScriptTag({ content: optionsScript });
    await page.waitForSelector("#autofillEnabled");

    assert.equal(await page.locator("#autofillEnabled").isChecked(), false, "stored disabled autofill should render unchecked in options");
    assert.equal(await page.locator("#fillPromptEnabled").isChecked(), false, "stored disabled fill prompts should render unchecked in options");
    assert.equal(await page.locator("#autosaveEnabled").isChecked(), true);
    assert.match(await page.locator("body").textContent(), /Show fill prompts for matching logins/);
    assert.match(await page.locator("body").textContent(), /Automatically fill matching session logins/);

    await page.locator("#autofillEnabled").check();
    await page.locator("#fillPromptEnabled").check();
    await page.locator("#autosaveEnabled").uncheck();
    await page.locator("#save").click();

    const syncStore = await page.evaluate(() => globalThis.__syncStore);
    assert.equal(syncStore.gvAutofillEnabled, true, "options should persist autofill setting changes");
    assert.equal(syncStore.gvFillPromptEnabled, true, "options should persist fill prompt setting changes");
    assert.equal(syncStore.gvAutosaveEnabled, false, "options should continue persisting autosave setting changes");
  } finally {
    await browser.close();
  }
});

test("browser extension options expose and persist the per-domain disabled list", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(optionsHtml.replace('<script src="options.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__syncStore = {
        gvServerUrl: "https://gvault.guber.dev",
        gvDisabledDomains: ["www.example.test", "ignored.test", "example.test"]
      };
      globalThis.chrome = {
        storage: {
          sync: {
            get: async (key) => {
              if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, globalThis.__syncStore[item]]));
              if (typeof key === "string") return { [key]: globalThis.__syncStore[key] };
              if (key && typeof key === "object") return Object.fromEntries(Object.entries(key).map(([item, fallback]) => [item, globalThis.__syncStore[item] ?? fallback]));
              return { ...globalThis.__syncStore };
            },
            set: async (value) => { Object.assign(globalThis.__syncStore, value); }
          }
        }
      };
    });
    await page.addScriptTag({ content: optionsScript });
    await page.waitForSelector("#disabledDomains");

    assert.equal(await page.locator("#disabledDomains").inputValue(), "example.test\nignored.test", "options should show normalized unique disabled domains");

    await page.locator("#disabledDomains").fill("https://www.new.test/login\nEXAMPLE.test\nnew.test");
    await page.locator("#save").click();

    const syncStore = await page.evaluate(() => globalThis.__syncStore);
    assert.deepEqual(syncStore.gvDisabledDomains, ["new.test", "example.test"], "options should persist normalized unique disabled domains");
  } finally {
    await browser.close();
  }
});

test("browser extension options expose and persist equivalent domain groups", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(optionsHtml.replace('<script src="options.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__syncStore = {
        gvServerUrl: "https://gvault.guber.dev",
        gvEquivalentDomains: [
          ["www.example.test", "login.example.test", "example.test"],
          ["shop.test", "checkout.shop.test"]
        ]
      };
      globalThis.chrome = {
        storage: {
          sync: {
            get: async (key) => {
              if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, globalThis.__syncStore[item]]));
              if (typeof key === "string") return { [key]: globalThis.__syncStore[key] };
              if (key && typeof key === "object") return Object.fromEntries(Object.entries(key).map(([item, fallback]) => [item, globalThis.__syncStore[item] ?? fallback]));
              return { ...globalThis.__syncStore };
            },
            set: async (value) => { Object.assign(globalThis.__syncStore, value); }
          }
        }
      };
    });
    await page.addScriptTag({ content: optionsScript });
    await page.waitForSelector("#equivalentDomains");

    assert.equal(
      await page.locator("#equivalentDomains").inputValue(),
      "example.test, login.example.test\nshop.test, checkout.shop.test",
      "options should show normalized unique equivalent-domain groups"
    );

    await page.locator("#equivalentDomains").fill("https://www.new-login.test/path, NEW.test\nshop.test, checkout.shop.test, shop.test");
    await page.locator("#save").click();

    const syncStore = await page.evaluate(() => globalThis.__syncStore);
    assert.deepEqual(syncStore.gvEquivalentDomains, [["new-login.test", "new.test"], ["shop.test", "checkout.shop.test"]], "options should persist normalized unique equivalent-domain groups");
  } finally {
    await browser.close();
  }
});

test("browser extension options expose and persist the subdomain matching setting", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(optionsHtml.replace('<script src="options.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__syncStore = {
        gvServerUrl: "https://gvault.guber.dev",
        gvSubdomainMatchingEnabled: false
      };
      globalThis.chrome = {
        storage: {
          sync: {
            get: async (key) => {
              if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, globalThis.__syncStore[item]]));
              if (typeof key === "string") return { [key]: globalThis.__syncStore[key] };
              if (key && typeof key === "object") return Object.fromEntries(Object.entries(key).map(([item, fallback]) => [item, globalThis.__syncStore[item] ?? fallback]));
              return { ...globalThis.__syncStore };
            },
            set: async (value) => { Object.assign(globalThis.__syncStore, value); }
          }
        }
      };
    });
    await page.addScriptTag({ content: optionsScript });
    await page.waitForSelector("#subdomainMatchingEnabled");

    assert.equal(await page.locator("#subdomainMatchingEnabled").isChecked(), false, "stored disabled subdomain matching should render unchecked in options");
    assert.match(await page.locator("body").textContent(), /Match saved logins on subdomains/);

    await page.locator("#subdomainMatchingEnabled").check();
    await page.locator("#save").click();

    const syncStore = await page.evaluate(() => globalThis.__syncStore);
    assert.equal(syncStore.gvSubdomainMatchingEnabled, true, "options should persist subdomain matching setting changes");
  } finally {
    await browser.close();
  }
});

async function renderPopupStatus(lastDetectedForms, expectedText) {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate((forms) => {
      globalThis.chrome = {
        runtime: {
          sendMessage: async () => ({ ok: true }),
          openOptionsPage() {}
        },
        storage: {
          sync: {
            get: async () => ({}),
            set: async () => undefined
          },
          session: {
            get: async () => ({ lastDetectedForms: forms }),
            set: async () => undefined
          }
        }
      };
    }, lastDetectedForms);
    await page.addScriptTag({ content: popupScript });
    await page.waitForFunction((text) => document.querySelector("#status")?.textContent?.includes(text), expectedText);
    return await page.locator("#status").textContent();
  } finally {
    await browser.close();
  }
}

function chromeLaunchOptions() {
  const executablePath = chromeExecutable();
  return executablePath ? { executablePath } : {};
}

function chromeExecutable() {
  if (process.env.GV_CHROME_EXECUTABLE) return process.env.GV_CHROME_EXECUTABLE;
  const candidates = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return candidates.find((candidate) => existsSync(candidate));
}
