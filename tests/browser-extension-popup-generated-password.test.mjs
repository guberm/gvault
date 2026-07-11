import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const popupHtml = await readFile("apps/browser-extension/src/popup.html", "utf8");
const popupScript = await readFile("apps/browser-extension/src/popup.js", "utf8");

test("popup generates in memory and fills only after the explicit generated-password action", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.__sentMessages = [];
      globalThis.__storageWrites = [];
      Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues(array) { array.fill(0); return array; } } });
      globalThis.chrome = {
        runtime: {
          sendMessage: async (message) => {
            globalThis.__sentMessages.push(message);
            if (message.type === "GV_FILL_GENERATED_PASSWORD") return { ok: true, filled: 1 };
            return { ok: true };
          },
          openOptionsPage() {}
        },
        tabs: {
          query: async () => [{ id: 7, url: "https://example.test/register" }],
          create: async (payload) => payload
        },
        storage: {
          onChanged: { addListener() {} },
          sync: { get: async () => ({}), set: async (value) => globalThis.__storageWrites.push(value) },
          session: { get: async () => ({}), set: async (value) => globalThis.__storageWrites.push(value), remove: async () => undefined }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });

    const fillButton = page.getByRole("button", { name: "Fill generated password" });
    assert.equal(await page.locator("#generatedPassword").getAttribute("readonly"), "");
    assert.equal(await fillButton.isDisabled(), true);

    await page.getByRole("button", { name: "Generate password" }).click();
    const generated = await page.locator("#generatedPassword").inputValue();
    assert.equal(generated, "AAAAAAAAAAAAAAAAAAAA");
    assert.equal(await fillButton.isDisabled(), false);
    assert.deepEqual(await page.evaluate(() => globalThis.__sentMessages.filter((message) => message.type === "GV_FILL_GENERATED_PASSWORD")), [], "generation alone must not message the active page");

    await fillButton.click();
    const generatedMessages = await page.evaluate(() => globalThis.__sentMessages.filter((message) => message.type === "GV_FILL_GENERATED_PASSWORD"));
    assert.deepEqual(generatedMessages, [{ type: "GV_FILL_GENERATED_PASSWORD", password: "AAAAAAAAAAAAAAAAAAAA" }]);
    assert.equal(await page.locator("#status").textContent(), "Filled the clicked password field. Click the confirmation field and repeat if needed.");
    assert.equal((await page.locator("#status").textContent()).includes(generated), false, "status must not reveal the generated secret");
    assert.equal(JSON.stringify(await page.evaluate(() => globalThis.__storageWrites)).includes(generated), false, "generated passwords must not be persisted");
  } finally {
    await browser.close();
  }
});

test("popup floors fractional generated-password lengths without hanging", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues(array) { array.fill(0); return array; } } });
      globalThis.chrome = {
        runtime: { sendMessage: async () => ({ ok: true }), openOptionsPage() {} },
        tabs: { query: async () => [{ id: 7, url: "https://example.test" }], create: async (payload) => payload },
        storage: {
          onChanged: { addListener() {} },
          sync: { get: async () => ({}), set: async () => undefined },
          session: { get: async () => ({}), set: async () => undefined, remove: async () => undefined }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });
    await page.locator("#generatedPasswordLength").evaluate((input) => { input.value = "12.5"; });

    const generated = await Promise.race([
      page.getByRole("button", { name: "Generate password" }).click().then(() => page.locator("#generatedPassword").inputValue()),
      new Promise((_, reject) => setTimeout(() => reject(new Error("fractional password generation timed out")), 1_000))
    ]);

    assert.equal(generated.length, 12, "fractional lengths use a predictable floor policy");
    assert.equal(await page.locator("#generatedPasswordLength").inputValue(), "12", "the popup displays the normalized length");
    assert.equal(await page.evaluate(() => secureRandomPassword(12.5).length), 12, "the generator itself defensively normalizes its input");

    for (const [input, expected] of [["", 20], ["1", 12], ["100", 64]]) {
      await page.locator("#generatedPasswordLength").evaluate((element, value) => { element.value = value; }, input);
      await page.getByRole("button", { name: "Generate password" }).click();
      assert.equal((await page.locator("#generatedPassword").inputValue()).length, expected);
      assert.equal(await page.locator("#generatedPasswordLength").inputValue(), String(expected));
    }
  } finally {
    await browser.close();
  }
});

test("popup preserves generated preview and reports an honest no-field warning", async () => {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues(array) { array.fill(0); return array; } } });
      globalThis.chrome = {
        runtime: { sendMessage: async (message) => message.type === "GV_FILL_GENERATED_PASSWORD" ? { ok: false, filled: 0, error: "Click directly in a visible password field on the page first, then try again." } : { ok: true }, openOptionsPage() {} },
        tabs: { query: async () => [{ id: 7, url: "https://example.test" }], create: async (payload) => payload },
        storage: {
          onChanged: { addListener() {} },
          sync: { get: async () => ({}), set: async () => undefined },
          session: { get: async () => ({}), set: async () => undefined, remove: async () => undefined }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });
    await page.getByRole("button", { name: "Generate password" }).click();
    const generated = await page.locator("#generatedPassword").inputValue();
    await page.getByRole("button", { name: "Fill generated password" }).click();
    assert.equal(await page.locator("#status").textContent(), "Click directly in a visible password field on the page first, then try again.");
    assert.equal(await page.locator("#generatedPassword").inputValue(), generated);
  } finally {
    await browser.close();
  }
});

function chromeLaunchOptions() {
  const executablePath = process.env.GV_CHROME_EXECUTABLE || ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
  return executablePath ? { executablePath } : {};
}
