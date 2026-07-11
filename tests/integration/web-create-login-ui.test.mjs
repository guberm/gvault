import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const root = join(process.cwd(), "apps/web/public");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
]);

test("web create-card starts a fresh Login item editor and saves the Login record locally", async () => {
  const server = await startStaticServer();
  let browser;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    await page.goto(baseUrl);
    await page.getByLabel("Master password").fill("local-master-password");
    await page.getByRole("button", { name: "Unlock vault" }).click();

    await page.locator("[name=title]").fill("Existing login");
    await page.locator("[name=url]").fill("https://old.example/login");
    await page.locator("[name=username]").fill("old@example.local");
    await page.locator("[name=password]").fill("old-password");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.locator(".item-row").filter({ hasText: "Existing login" }).click();

    await page.getByRole("button", { name: "Create Login item" }).click();

    await assertInputValue(page, "[name=type]", "login");
    await assertInputValue(page, "[name=title]", "");
    await assertInputValue(page, "[name=url]", "");
    await assertInputValue(page, "[name=username]", "");
    await assertInputValue(page, "[name=password]", "");
    await expectText(page, "#formTitle", "New login");
    await expectText(page, "#status", "Creating a new Login item");

    await page.locator("[name=title]").fill("GitHub Work");
    await page.locator("[name=url]").fill("https://github.com/login");
    await page.locator("[name=username]").fill("michael@guber.dev");
    await page.locator("#passwordLength").evaluate((input) => {
      input.value = "12";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expectText(page, "#strengthLabel", "12 characters, 73 bits, good");
    await expectText(page, "#strengthRating", "Good");
    await page.locator("#passwordLength").evaluate((input) => {
      input.value = "28";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("#useUpper").uncheck();
    await page.evaluate(() => {
      window.crypto.getRandomValues = (array) => {
        array[0] = 0;
        return array;
      };
    });
    await expectText(page, "#strengthLabel", "28 characters");
    await page.locator("#generateButton").click();
    const generatedPassword = await page.locator("[name=password]").inputValue();
    assert.equal(generatedPassword.length, 28, "generated password follows the selected length control");
    assert.doesNotMatch(generatedPassword, /[A-Z]/, "uppercase toggle removes uppercase letters from generated passwords");
    assert.equal((await page.locator("#generatedPassword").inputValue()).length, 28, "generator preview follows the selected length control");

    await page.locator("#useUpper").check();
    await page.locator("#useLower").uncheck();
    await expectText(page, "#strengthLabel", "28 characters, 150 bits, strong");
    await page.evaluate(() => {
      window.crypto.getRandomValues = (array) => {
        array[0] = 24;
        return array;
      };
    });
    await page.locator("#generateButton").click();
    const uppercaseOnlyPassword = await page.locator("[name=password]").inputValue();
    assert.equal(uppercaseOnlyPassword.length, 28, "lowercase toggle preserves generated length");
    assert.doesNotMatch(uppercaseOnlyPassword, /[a-z]/, "lowercase toggle removes lowercase letters from generated passwords");
    assert.equal((await page.locator("#generatedPassword").inputValue()).length, 28, "generator preview follows lowercase toggle length");

    await page.locator("#useNumbers").uncheck();
    await expectText(page, "#strengthLabel", "28 characters, 141 bits, strong");
    await page.evaluate(() => {
      window.crypto.getRandomValues = (array) => {
        array[0] = 24;
        return array;
      };
    });
    await page.locator("#generateButton").click();
    const numberFreePassword = await page.locator("[name=password]").inputValue();
    assert.equal(numberFreePassword.length, 28, "numbers toggle preserves generated length");
    assert.doesNotMatch(numberFreePassword, /[0-9]/, "numbers toggle removes digits from generated passwords");
    assert.equal((await page.locator("#generatedPassword").inputValue()).length, 28, "generator preview follows numbers toggle length");

    await page.locator("#useNumbers").check();
    await page.locator("#useSymbols").uncheck();
    await expectText(page, "#strengthLabel", "28 characters, 140 bits, strong");
    await page.evaluate(() => {
      window.crypto.getRandomValues = (array) => {
        array[0] = 32;
        return array;
      };
    });
    await page.locator("#generateButton").click();
    const symbolFreePassword = await page.locator("[name=password]").inputValue();
    assert.equal(symbolFreePassword.length, 28, "symbols toggle preserves generated length");
    assert.doesNotMatch(symbolFreePassword, /[!@#$%^&*?]/, "symbols toggle removes symbols from generated passwords");
    assert.equal((await page.locator("#generatedPassword").inputValue()).length, 28, "generator preview follows symbols toggle length");

    const excludeAmbiguous = page.locator("#excludeAmbiguous");
    assert.equal(await excludeAmbiguous.isChecked(), true, "ambiguous characters are excluded by default");
    await page.evaluate(() => {
      window.crypto.getRandomValues = (array) => {
        array[0] = 8;
        return array;
      };
    });
    await page.locator("#generateButton").click();
    const ambiguitySafePassword = await page.locator("[name=password]").inputValue();
    assert.doesNotMatch(ambiguitySafePassword, /[Il1O0]/, "exclude ambiguous removes confusing characters");

    await excludeAmbiguous.uncheck();
    await expectText(page, "#strengthLabel", "28 characters, 145 bits, strong");
    await page.locator("#generateButton").click();
    const fullAlphabetPassword = await page.locator("[name=password]").inputValue();
    assert.match(fullAlphabetPassword, /I/, "disabling exclude ambiguous restores the full alphabet");

    await page.locator("#usePassphrase").check();
    await page.evaluate(() => {
      window.crypto.getRandomValues = (array) => {
        array[0] = 0;
        return array;
      };
    });
    await page.locator("#generateButton").click();
    const generatedPassphrase = "cedar-cedar-cedar-cedar-10";
    assert.equal(await page.locator("[name=password]").inputValue(), generatedPassphrase, "passphrase mode fills the Login password field");
    assert.equal(await page.locator("#generatedPassword").inputValue(), generatedPassphrase, "passphrase mode updates the generator preview");
    await expectText(page, "#strengthLabel", "4 words + 2 digits, 21 bits, weak");
    await expectText(page, "#strengthRating", "Weak");

    await page.locator("#usePassphrase").uncheck();
    await page.locator("#useUpper").uncheck();
    await page.locator("#useNumbers").uncheck();
    await expectText(page, "#strengthLabel", "No character sets selected, unavailable");
    await expectText(page, "#strengthRating", "Unavailable");
    await page.locator("#generateButton").click();
    assert.equal(await page.locator("[name=password]").inputValue(), generatedPassphrase, "unavailable generator preserves the existing password");
    await expectText(page, "#status", "Select at least one character set");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expectText(page, "#detailTitle", "GitHub Work");
    await expectText(page, "#items", "GitHub Work");
    await expectText(page, "#items", "Existing login");
    assert.equal(await page.locator(".item-row").count(), 2, "new Login item is added without overwriting the existing item");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("password generator copies only the current preview and reports clipboard failures honestly", async () => {
  const server = await startStaticServer();
  let browser;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      window.__clipboardWrites = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.__clipboardWrites.push(value);
          },
        },
      });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel("Master password").fill("local-master-password");
    await page.getByRole("button", { name: "Unlock vault" }).click();

    const copyButton = page.getByRole("button", { name: "Copy generated password" });
    await assertInputValue(page, "#generatedPassword", "");
    assert.equal(await copyButton.isDisabled(), true, "copy is unavailable while the preview is empty");

    await page.locator("#generateButton").click();
    const generatedPassword = await page.locator("#generatedPassword").inputValue();
    assert.notEqual(generatedPassword, "", "generation populates the password preview");
    assert.equal(await copyButton.isEnabled(), true, "copy becomes available after generation");

    await copyButton.click();
    assert.deepEqual(await page.evaluate(() => window.__clipboardWrites), [generatedPassword]);
    await expectText(page, "#status", "Generated password copied.");

    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => {
        throw new Error("clipboard rejected");
      };
    });
    await copyButton.click();
    await expectText(page, "#status", "Could not copy generated password.");
    assert.doesNotMatch(await page.locator("#status").textContent(), new RegExp(generatedPassword));

    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    });
    await copyButton.click();
    await expectText(page, "#status", "Could not copy generated password.");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

function chromeLaunchOptions() {
  const executablePath = chromeExecutable();
  return executablePath ? { executablePath } : {};
}

function chromeExecutable() {
  if (process.env.GV_CHROME_EXECUTABLE) return process.env.GV_CHROME_EXECUTABLE;
  const candidates = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return candidates.find((candidate) => existsSync(candidate));
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const safePath = pathname.replace(/^\/+/, "");
    try {
      const file = await readFile(join(root, safePath));
      response.writeHead(200, { "content-type": contentTypes.get(extname(safePath)) || "application/octet-stream" });
      response.end(file);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

async function assertInputValue(page, selector, expected) {
  const actual = await page.locator(selector).inputValue();
  assert.equal(actual, expected);
}

async function expectText(page, selector, text) {
  await waitUntil(async () => ((await page.locator(selector).textContent()) || "").includes(text), `text ${text}`);
}

async function waitUntil(predicate, label) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting ${label}`);
}
