import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(".");
const chromeExtensionPath = join(root, "apps/browser-extension/dist/chrome");

test("Chrome extension loads and fills a login form in Google Chrome", { skip: skipReason() }, async () => {
  assert.ok(existsSync(chromeExtensionPath), "Chrome extension build exists");
  const manifest = JSON.parse(await readFile(join(chromeExtensionPath, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3, "Chrome extension is Manifest V3");
  assert.equal(manifest.name, "GVault", "Chrome build uses Chrome product name");

  const webPort = 25080 + Math.floor(Math.random() * 1000);
  const web = await serveLoginPage(webPort);
  const userDataDir = await mkdtemp(join(tmpdir(), "gvault-chrome-extension-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: chromeExecutable(),
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });

  try {
    const browserSession = await context.browser().newBrowserCDPSession();
    const { id: extensionId } = await browserSession.send("Extensions.loadUnpacked", { path: chromeExtensionPath });
    assert.ok(extensionId, "Chrome extension id returned by CDP Extensions.loadUnpacked");

    const { extensions } = await browserSession.send("Extensions.getExtensions");
    const loadedExtension = extensions.find((extension) => extension.id === extensionId);
    assert.equal(loadedExtension?.name, "GVault", "loaded unpacked extension is the Chrome build");
    assert.equal(loadedExtension?.enabled, true, "loaded Chrome extension is enabled");

    const identityPage = await context.newPage();
    const identityUrl = `http://127.0.0.1:${webPort}/identity-address-test.html`;
    await identityPage.goto(identityUrl);
    await identityPage.waitForSelector("input[autocomplete='street-address']");

    const identityPopup = await context.newPage();
    await identityPopup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expectText(identityPopup, "body", "Self-hosted autofill");
    await expectText(identityPopup, "#status", "identity/address form");
    await identityPopup.close();
    await identityPage.close();

    const page = await context.newPage();
    const loginUrl = `http://127.0.0.1:${webPort}/login-test.html`;
    await page.goto(loginUrl);
    await page.waitForSelector("input[type=password]");

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expectText(popup, "body", "Self-hosted autofill");
    await expectText(popup, "#status", "login form");

    const tabId = await popup.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      return tabs[0]?.id;
    }, loginUrl);
    assert.ok(tabId, "login test tab is visible to the Chrome extension");

    const fillResult = await popup.evaluate(async ({ tabId }) => {
      return chrome.tabs.sendMessage(tabId, {
        type: "GV_FILL_LOGIN",
        username: "chrome-extension-user",
        password: "chrome-extension-pass"
      });
    }, { tabId });
    assert.equal(fillResult.filled, 1, "Chrome extension reports one filled login form");

    await waitUntil(async () => (await page.locator("#email").inputValue()) === "chrome-extension-user", "Chrome extension filled email login identifier");
    assert.equal(await page.locator("#password").inputValue(), "chrome-extension-pass");
    assert.equal(await page.locator("#search").inputValue(), "", "Chrome extension does not fill non-credential search fields");

    await popup.locator("#serverUrl").fill("https://gvault.guber.dev");
    await popup.locator("#saveServer").click();
    await expectText(popup, "#status", "Server URL saved");

    const storedServerUrl = await popup.evaluate(async () => {
      const { gvServerUrl } = await chrome.storage.sync.get("gvServerUrl");
      return gvServerUrl;
    });
    assert.equal(storedServerUrl, "https://gvault.guber.dev", "Chrome extension persists the live GVault server URL");

    const liveHealth = await popup.evaluate(async () => {
      const response = await fetch("https://gvault.guber.dev/healthz");
      return { ok: response.ok, status: response.status, body: await response.text() };
    });
    assert.equal(liveHealth.ok, true, "Chrome extension page can reach live GVault health endpoint");
    assert.equal(liveHealth.status, 200, "live GVault health endpoint returns HTTP 200");
    assert.match(liveHealth.body, /ok|\"ok\":true/, "live GVault health response confirms ok status");
  } finally {
    await context.close();
    await closeServer(web);
  }
});

function chromeExecutable() {
  if (process.env.GV_CHROME_EXECUTABLE) return process.env.GV_CHROME_EXECUTABLE;
  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
      ]
    : process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser"
        ];
  return candidates.find((candidate) => existsSync(candidate));
}

function skipReason() {
  if (!chromeExecutable()) return "Google Chrome executable not found";
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    return "Headed Google Chrome display not available";
  }
  return false;
}

async function serveLoginPage(port) {
  const server = createServer((req, res) => {
    if (req.url === "/login-test.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html>
        <html><body>
          <form>
            <label>Search <input id="search" name="q"></label>
            <label>Email <input id="email" name="email" type="email" autocomplete="email"></label>
            <label>Password <input id="password" name="password" type="password" autocomplete="current-password"></label>
            <button>Login</button>
          </form>
        </body></html>`);
      return;
    }
    if (req.url === "/identity-address-test.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html>
        <html><body>
          <form id="contact">
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
        </body></html>`);
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
