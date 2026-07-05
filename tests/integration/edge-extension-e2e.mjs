import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(".");
const edgeExtensionPath = join(root, "apps/browser-extension/dist/edge");

test("Edge extension loads and fills a login form in Microsoft Edge", { skip: !edgeExecutable() && "Microsoft Edge executable not found" }, async () => {
  assert.ok(existsSync(edgeExtensionPath), "Edge extension build exists");
  const manifest = JSON.parse(await readFile(join(edgeExtensionPath, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3, "Edge extension is Manifest V3");
  assert.equal(manifest.name, "GVault for Edge", "Edge build uses Edge-specific product name");

  const webPort = 24080 + Math.floor(Math.random() * 1000);
  const web = await serveLoginPage(webPort);
  const userDataDir = await mkdtemp(join(tmpdir(), "gvault-edge-extension-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: edgeExecutable(),
    args: [
      `--disable-extensions-except=${edgeExtensionPath}`,
      `--load-extension=${edgeExtensionPath}`,
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });

  try {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) serviceWorker = await context.waitForEvent("serviceworker", { timeout: 15000 });
    const extensionId = serviceWorker.url().split("/")[2];
    assert.ok(extensionId, "Edge extension id detected from service worker");

    const extensionName = await serviceWorker.evaluate(async () => chrome.runtime.getManifest().name);
    assert.equal(extensionName, "GVault for Edge", "loaded service worker belongs to the Edge build");

    const page = await context.newPage();
    const loginUrl = `http://127.0.0.1:${webPort}/login-test.html`;
    await page.goto(loginUrl);
    await page.waitForSelector("input[type=password]");

    const tabId = await serviceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      return tabs[0]?.id;
    }, loginUrl);
    assert.ok(tabId, "login test tab is visible to the Edge extension");

    await serviceWorker.evaluate(async ({ tabId }) => {
      await chrome.tabs.sendMessage(tabId, {
        type: "GV_FILL_LOGIN",
        username: "edge-extension-user",
        password: "edge-extension-pass"
      });
    }, { tabId });

    await waitUntil(async () => (await page.locator("#username").inputValue()) === "edge-extension-user", "Edge extension filled username");
    assert.equal(await page.locator("#password").inputValue(), "edge-extension-pass");

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expectText(popup, "body", "Self-hosted autofill");
    await expectText(popup, "#status", "login form");
    await popup.locator("#serverUrl").fill("https://gvault.guber.dev");
    await popup.locator("#saveServer").click();
    await expectText(popup, "#status", "Server URL saved");

    const storedServerUrl = await serviceWorker.evaluate(async () => {
      const { gvServerUrl } = await chrome.storage.sync.get("gvServerUrl");
      return gvServerUrl;
    });
    assert.equal(storedServerUrl, "https://gvault.guber.dev", "Edge extension persists the live GVault server URL");

    const liveHealth = await popup.evaluate(async () => {
      const response = await fetch("https://gvault.guber.dev/healthz");
      return { ok: response.ok, status: response.status, body: await response.text() };
    });
    assert.equal(liveHealth.ok, true, "Edge extension page can reach live GVault health endpoint");
    assert.equal(liveHealth.status, 200, "live GVault health endpoint returns HTTP 200");
    assert.match(liveHealth.body, /ok|\"ok\":true/, "live GVault health response confirms ok status");
  } finally {
    await context.close();
    await closeServer(web);
  }
});

function edgeExecutable() {
  if (process.env.GV_EDGE_EXECUTABLE) return process.env.GV_EDGE_EXECUTABLE;
  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
      ]
    : [
        "/usr/bin/microsoft-edge",
        "/usr/bin/microsoft-edge-stable",
        "/opt/microsoft/msedge/msedge"
      ];
  return candidates.find((candidate) => existsSync(candidate));
}

async function serveLoginPage(port) {
  const server = createServer((req, res) => {
    if (req.url === "/login-test.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html>
        <html><body>
          <form>
            <label>Username <input id="username" name="username" autocomplete="username"></label>
            <label>Password <input id="password" name="password" type="password" autocomplete="current-password"></label>
            <button>Login</button>
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
