import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const contentScript = await readFile("apps/browser-extension/src/content-script.js", "utf8");

test("browser extension detects semantic identity and address forms only", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(`<!doctype html>
      <form id="contact">
        <label>Search <input id="contact-search" name="q" type="search"></label>
        <label>Full name <input id="full-name" name="fullName" autocomplete="name"></label>
        <label>Email <input id="contact-email" name="email" type="email" autocomplete="email"></label>
        <label>Phone <input id="phone" name="phone" autocomplete="tel"></label>
      </form>
      <form id="shipping">
        <label>Street <input id="street" name="address1" autocomplete="street-address"></label>
        <label>City <input id="city" name="city" autocomplete="address-level2"></label>
        <label>State <input id="state" name="state" autocomplete="address-level1"></label>
        <label>Postal code <input id="postal" name="postalCode" autocomplete="postal-code"></label>
        <label>Country <input id="country" name="country" autocomplete="country-name"></label>
      </form>
      <form id="newsletter">
        <label>Email updates <input id="newsletter-email" name="email" type="email"></label>
        <button>Subscribe</button>
      </form>
      <form id="site-search">
        <label>Find <input id="search" name="search" type="search"></label>
      </form>`);
    await page.evaluate(() => {
      globalThis.__gvaultMessages = [];
      globalThis.chrome = {
        runtime: {
          onMessage: { addListener(listener) { globalThis.__gvaultListener = listener; } },
          sendMessage(message) { globalThis.__gvaultMessages.push(message); }
        }
      };
    });
    await page.addScriptTag({ content: contentScript });

    const context = await sendContentMessage(page, { type: "GV_FORM_CONTEXT" });
    assert.equal(context.count, 0, "identity/address pages are not misreported as login forms");
    assert.equal(context.identityAddressCount, 2, "contact and shipping forms are detected as identity/address forms");
    assert.deepEqual(context.identityAddressTypes.sort(), ["address", "identity"], "detected identity/address form types are reported");

    const detected = await page.evaluate(() => globalThis.__gvaultMessages.find((message) => message.type === "GV_FORMS_DETECTED"));
    assert.equal(detected.identityAddressCount, 2, "startup detection reports identity/address forms");
    assert.equal(detected.count, 0, "startup detection still reports zero login forms");
  } finally {
    await browser.close();
  }
});

async function sendContentMessage(page, message) {
  return page.evaluate((payload) => new Promise((resolve) => {
    globalThis.__gvaultListener(payload, {}, resolve);
  }), message);
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
