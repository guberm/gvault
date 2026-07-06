import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const contentScript = await readFile("apps/browser-extension/src/content-script.js", "utf8");

test("browser extension detects semantic payment-card forms only", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.setContent(`<!doctype html>
      <form id="card">
        <label>Name on card <input id="cc-name" name="ccName" autocomplete="cc-name"></label>
        <label>Card number <input id="cc-number" name="cardNumber" inputmode="numeric" autocomplete="cc-number"></label>
        <label>Expiry month <input id="cc-month" name="expMonth" autocomplete="cc-exp-month"></label>
        <label>Expiry year <input id="cc-year" name="expYear" autocomplete="cc-exp-year"></label>
        <label>Security code <input id="cc-csc" name="cvv" autocomplete="cc-csc"></label>
      </form>
      <form id="card-without-name">
        <label>Card number <input id="cc2-number" name="cardNumber" inputmode="numeric" autocomplete="cc-number"></label>
        <label>Expiry <input id="cc2-exp" name="expiration" autocomplete="cc-exp"></label>
        <label>CVC <input id="cc2-csc" name="cvc" autocomplete="cc-csc"></label>
      </form>
      <form id="profile">
        <label>Full name <input id="full-name" name="fullName" autocomplete="name"></label>
        <label>Email <input id="email" name="email" type="email" autocomplete="email"></label>
        <label>Phone <input id="phone" name="phone" type="tel" autocomplete="tel"></label>
      </form>
      <form id="login">
        <label>Email <input id="login-email" name="email" type="email" autocomplete="email"></label>
        <label>Password <input id="password" name="password" type="password" autocomplete="current-password"></label>
      </form>
      <form id="search">
        <label>Find card articles <input id="search-input" name="cardSearch" type="search"></label>
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
    assert.equal(context.count, 1, "login form is still reported as a login form");
    assert.equal(context.identityAddressCount, 1, "profile form is still reported as identity/address");
    assert.equal(context.paymentCardCount, 2, "payment-card forms are detected separately");
    assert.deepEqual(context.paymentCardTypes, ["paymentCard", "paymentCard"], "detected payment-card form type is reported");

    const detected = await page.evaluate(() => globalThis.__gvaultMessages.find((message) => message.type === "GV_FORMS_DETECTED"));
    assert.equal(detected.paymentCardCount, 2, "startup detection reports payment-card forms");
    assert.equal(detected.count, 1, "startup detection still reports login forms");
    assert.equal(detected.identityAddressCount, 1, "startup detection still reports identity/address forms");
  } finally {
    await browser.close();
  }
});

async function sendContentMessage(page, message) {
  return page.evaluate((payload) => new Promise((resolve) => {
    globalThis.__gvaultListener(payload, {}, resolve);
  }), message);
}
