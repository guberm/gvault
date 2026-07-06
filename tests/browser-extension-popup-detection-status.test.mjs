import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const popupHtml = await readFile("apps/browser-extension/src/popup.html", "utf8");
const popupScript = await readFile("apps/browser-extension/src/popup.js", "utf8");

test("browser extension popup reports identity/address detection from content script", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
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
            get: async () => ({
              lastDetectedForms: {
                count: 0,
                identityAddressCount: 2,
                identityAddressTypes: ["identity", "address"],
                url: "https://example.test/profile",
                host: "example.test"
              }
            }),
            set: async () => undefined
          }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });
    await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("identity/address"));
    assert.equal(await page.locator("#status").textContent(), "2 identity/address forms detected on this page.");
  } finally {
    await browser.close();
  }
});
