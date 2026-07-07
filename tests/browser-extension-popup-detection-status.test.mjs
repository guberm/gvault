import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const popupHtml = await readFile("apps/browser-extension/src/popup.html", "utf8");
const popupScript = await readFile("apps/browser-extension/src/popup.js", "utf8");

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
