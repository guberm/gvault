import test from "node:test";
import assert from "node:assert/strict";
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

async function renderPopupStatus(lastDetectedForms, expectedText) {
  const browser = await chromium.launch();
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
