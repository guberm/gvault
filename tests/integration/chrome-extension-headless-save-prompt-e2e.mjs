import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(".");
const extensionPath = join(root, "apps/browser-extension/dist/chrome");

test("headless Chrome CDP loads extension and shows save-new-login prompt", { skip: !chromeExecutable() && "Google Chrome executable not found" }, async () => {
  assert.ok(existsSync(extensionPath), "Chrome extension build exists");
  const port = 26080 + Math.floor(Math.random() * 1000);
  const web = await serveLoginPage(port);
  const userDataDir = await mkdtemp(join(tmpdir(), "gvault-chrome-headless-extension-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: chromeExecutable(),
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--no-first-run", "--no-default-browser-check"]
  });

  try {
    const browserSession = await context.browser().newBrowserCDPSession();
    const { id: extensionId } = await browserSession.send("Extensions.loadUnpacked", { path: extensionPath });
    assert.ok(extensionId, "Chrome extension id returned by CDP Extensions.loadUnpacked");

    const page = await context.newPage();
    const loginUrl = `http://127.0.0.1:${port}/login-test.html`;
    await page.goto(loginUrl);
    await page.waitForSelector("input[type=password]");

    await page.locator("#email").fill("headless-capture@example.test");
    await page.locator("#password").fill("headless-capture-pass");
    await page.locator("form").evaluate((form) => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expectText(popup, "#savePrompt", "Save login for 127.0.0.1");
    await expectText(popup, "#savePrompt", "headless-capture@example.test");
    assert.equal(await popup.locator("#username").inputValue(), "headless-capture@example.test");
    assert.equal(await popup.locator("#password").inputValue(), "headless-capture-pass");
  } finally {
    await context.close();
    await closeServer(web);
  }
});

function chromeExecutable() {
  if (process.env.GV_CHROME_EXECUTABLE) return process.env.GV_CHROME_EXECUTABLE;
  const candidates = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return candidates.find((candidate) => existsSync(candidate));
}

async function serveLoginPage(port) {
  const server = createServer((req, res) => {
    if (req.url === "/login-test.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html><html><body><form><label>Email <input id="email" name="email" type="email" autocomplete="email"></label><label>Password <input id="password" name="password" type="password" autocomplete="current-password"></label><button>Login</button></form></body></html>`);
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });
  await new Promise((resolveListen) => server.listen(port, "127.0.0.1", resolveListen));
  return server;
}

async function expectText(page, selector, text) {
  await waitUntil(async () => new RegExp(text).test((await page.locator(selector).textContent()) ?? ""), `text ${text}`);
}

async function waitUntil(predicate, label) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out waiting ${label}`);
}

async function closeServer(server) {
  await new Promise((resolveClose) => server.close(resolveClose));
}
