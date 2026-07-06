import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const contentScript = await readFile("apps/browser-extension/src/content-script.js", "utf8");

test("browser extension detects and fills semantic login forms only", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.setContent(`<!doctype html>
      <form id="login">
        <label>Search <input id="search" name="q" type="text"></label>
        <label>Email <input id="email" name="email" type="email" autocomplete="email"></label>
        <label>Password <input id="password" name="password" type="password" autocomplete="current-password"></label>
      </form>
      <form id="signup">
        <label>Name <input id="name" name="name" type="text"></label>
        <label>New password <input id="new-password" name="new-password" type="password" autocomplete="new-password"></label>
        <label>Confirm password <input id="confirm-password" name="confirm-password" type="password" autocomplete="new-password"></label>
      </form>
      <form id="signup-confirm-only">
        <label>Email <input id="signup-email" name="email" type="email"></label>
        <label>Password <input id="signup-password" name="password" type="password"></label>
        <label>Confirm password <input id="signup-password-confirmation" name="password_confirmation" type="password"></label>
      </form>
      <form id="signup-tokenized-autocomplete">
        <label>Email <input id="token-email" name="email" type="email"></label>
        <label>Password <input id="token-password" name="password" type="password" autocomplete="section-register new-password"></label>
      </form>
      <form id="disabled">
        <label>User <input id="disabled-user" name="username" disabled></label>
        <label>Pass <input id="disabled-pass" name="password" type="password" disabled></label>
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
    assert.equal(context.count, 1, "only the sign-in form is detected as a login form");

    const fill = await sendContentMessage(page, {
      type: "GV_FILL_LOGIN",
      username: "person@example.com",
      password: "correct horse battery staple"
    });
    assert.equal(fill.filled, 1, "only one login form is filled");
    assert.equal(await page.locator("#email").inputValue(), "person@example.com");
    assert.equal(await page.locator("#password").inputValue(), "correct horse battery staple");
    assert.equal(await page.locator("#search").inputValue(), "", "non-credential text fields are not filled");
    assert.equal(await page.locator("#name").inputValue(), "", "signup profile fields are not filled");
    assert.equal(await page.locator("#new-password").inputValue(), "", "new-password fields are not treated as login forms");
  } finally {
    await browser.close();
  }
});

async function sendContentMessage(page, message) {
  return page.evaluate((payload) => new Promise((resolve) => {
    globalThis.__gvaultListener(payload, {}, resolve);
  }), message);
}
