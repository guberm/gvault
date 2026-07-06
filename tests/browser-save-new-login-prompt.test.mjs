import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const contentScript = await readFile("apps/browser-extension/src/content-script.js", "utf8");

test("browser extension captures a submitted login for a save-new-login prompt", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.setContent(`<!doctype html>
      <form id="login" action="/session">
        <label>Email <input id="email" name="email" type="email" autocomplete="email"></label>
        <label>Password <input id="password" name="password" type="password" autocomplete="current-password"></label>
        <button id="submit" type="submit">Sign in</button>
      </form>
      <form id="signup">
        <label>Email <input id="signup-email" name="email" type="email" autocomplete="email"></label>
        <label>New password <input id="new-password" name="newPassword" type="password" autocomplete="new-password"></label>
        <button id="signup-submit" type="submit">Create account</button>
      </form>`);
    await page.evaluate(() => {
      globalThis.__gvaultMessages = [];
      globalThis.chrome = {
        runtime: {
          onMessage: { addListener(listener) { globalThis.__gvaultListener = listener; } },
          sendMessage(message) { globalThis.__gvaultMessages.push(message); return Promise.resolve({ ok: true }); }
        }
      };
    });
    await page.addScriptTag({ content: contentScript });

    await page.locator("#email").fill("new-login@example.test");
    await page.locator("#password").fill("captured-password");
    await page.evaluate(() => document.querySelector("#login").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    const prompt = await page.evaluate(() => globalThis.__gvaultMessages.find((message) => message.type === "GV_LOGIN_SUBMITTED"));
    assert.ok(prompt, "submitted login creates a save prompt message");
    assert.equal(prompt.username, "new-login@example.test");
    assert.equal(prompt.password, "captured-password");
    assert.equal(prompt.url, "about:blank");
    assert.equal(prompt.host, "");

    await page.locator("#signup-email").fill("signup@example.test");
    await page.locator("#new-password").fill("new-account-password");
    await page.evaluate(() => document.querySelector("#signup").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    const prompts = await page.evaluate(() => globalThis.__gvaultMessages.filter((message) => message.type === "GV_LOGIN_SUBMITTED"));
    assert.equal(prompts.length, 1, "new-password signup forms are not save-login prompts");
  } finally {
    await browser.close();
  }
});
