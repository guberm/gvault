import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { chromium } from "playwright";

const root = resolve(".");
const results = [];

let api;
let web;

try {
  const serverPort = 21080 + Math.floor(Math.random() * 1000);
  const webPort = serverPort + 1;
  const dataDir = await mkdtemp(join(tmpdir(), "gvault-e2e-"));

  api = spawn(process.execPath, ["apps/server/dist/index.js"], {
    cwd: root,
    env: {
      ...process.env,
      GV_DATA_DIR: dataDir,
      GV_SERVER_HOST: "127.0.0.1",
      GV_SERVER_PORT: String(serverPort),
      GV_ALLOWED_ORIGINS: "*",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await waitForUrl(`http://127.0.0.1:${serverPort}/healthz`);
  results.push("server health ok");

  web = await serveStatic(join(root, "apps/web/dist"), webPort);
  await webClientE2e(webPort, serverPort);
  results.push("web client e2e ok");

  await chromeExtensionE2e(webPort);
  results.push("chrome extension e2e ok");

  await edgeExtensionE2e(webPort);
  results.push("edge extension e2e ok");

  await windowsClientE2e();
  results.push("windows client launch smoke ok");

  await linuxClientE2e();
  results.push("linux client wsl smoke ok");

  console.log(results.join("\n"));
} catch (error) {
  console.error(results.join("\n"));
  throw error;
} finally {
  if (api) api.kill();
  if (web) await closeServer(web);
}

async function webClientE2e(webPort, serverPort) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  try {
    await page.goto(`http://127.0.0.1:${webPort}/`);
    await expectText(page, "body", "Self-hosted password and identity vault");
    await expectText(page, "#status", "Connect a server");

    await page.locator("#serverUrl").fill(`http://127.0.0.1:${serverPort}`);
    await page.locator("#email").fill(`e2e-${Date.now()}@example.local`);
    await page.locator("#accountPassword").fill("change-me-strong-password");
    await page.getByRole("button", { name: "Register" }).click();
    await expectText(page, "#status", "Server session");

    await page.getByLabel("Master password").fill("correct horse battery staple");
    await page.getByRole("button", { name: "Unlock vault" }).click();
    await expectText(page, "#lockState", "Unlocked");

    await page.getByLabel("Title").fill("Example Login");
    await page.getByLabel("URL").fill("https://example.com/login");
    await page.getByLabel("Username").fill("demo@example.com");
    await page.getByRole("button", { name: "Generate" }).click();
    await page.getByRole("button", { name: "Save item" }).click();
    await expectText(page, "#detailTitle", "Example Login");
    assert.equal(await page.locator(".item-row").count(), 1);

    await page.getByLabel("Search vault").fill("Example");
    assert.equal(await page.locator(".item-row").count(), 1);

    await page.locator("#syncButton").click();
    await expectText(page, "#status", "Sync complete");

    await page.getByRole("button", { name: "Secure notes" }).click();
    await expectText(page, "#items", "No matching items");

    await page.setViewportSize({ width: 390, height: 900 });
    await expectText(page, "body", "GVault");
  } finally {
    await browser.close();
  }
}

async function chromeExtensionE2e(webPort) {
  await extensionE2e(chromium, undefined, join(root, "apps/browser-extension/dist/chrome"), webPort);
}

async function edgeExtensionE2e(webPort) {
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  if (!existsSync(edgePath)) return;
  await extensionE2e(chromium, edgePath, join(root, "apps/browser-extension/dist/edge"), webPort);
}

async function extensionE2e(browserType, executablePath, extensionPath, webPort) {
  assert.ok(existsSync(extensionPath), `extension missing: ${extensionPath}`);
  const userDataDir = await mkdtemp(join(tmpdir(), "gvault-ext-"));
  const context = await browserType.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) serviceWorker = await context.waitForEvent("serviceworker", { timeout: 10000 });
    const extensionId = serviceWorker.url().split("/")[2];
    assert.ok(extensionId, "extension id missing");

    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${webPort}/login-test.html`);
    await page.waitForSelector("input[type=password]");

    const tabId = await serviceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      return tabs[0]?.id;
    }, `http://127.0.0.1:${webPort}/login-test.html`);
    assert.ok(tabId, "test tab not visible to extension");

    await serviceWorker.evaluate(async ({ tabId }) => {
      await chrome.tabs.sendMessage(tabId, { type: "GV_FILL_LOGIN", username: "extension-user", password: "extension-pass" });
    }, { tabId });

    await waitUntil(async () => (await page.locator("#username").inputValue()) === "extension-user", "extension filled username");
    assert.equal(await page.locator("#password").inputValue(), "extension-pass");

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expectText(popup, "body", "Self-hosted autofill");
    await popup.getByLabel("Username").fill("popup-user");
    await popup.getByLabel("Password").fill("popup-pass");
    await expectText(popup, "#status", "form");
  } finally {
    await context.close();
  }
}

async function windowsClientE2e() {
  if (process.platform !== "win32") return;
  const exe = join(root, "apps/desktop/dist/windows-x64/GVault.exe");
  assert.ok(existsSync(exe), "GVault.exe missing");
  const child = spawn(exe, [], { detached: true, stdio: "ignore" });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert.equal(child.killed, false);
  process.kill(child.pid);
}

async function linuxClientE2e() {
  if (process.platform !== "win32") return;
  const binary = join(root, "apps/desktop/dist/linux-x64/GVault");
  assert.ok(existsSync(binary), "Linux GVault binary missing");
  const linuxPath = `/mnt/${binary[0].toLowerCase()}${binary.slice(2).replaceAll("\\", "/").replace(":", "")}`;
  const output = await run("wsl.exe", ["--exec", linuxPath]);
  assert.match(output, /GVault/);
}

async function serveStatic(dir, port) {
  const server = createServer(async (req, res) => {
    try {
      if (req.url === "/login-test.html") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(`<form><input id="username" autocomplete="username"><input id="password" type="password"><button>Login</button></form>`);
        return;
      }
      const pathname = req.url === "/" ? "/index.html" : new URL(req.url ?? "/", "http://localhost").pathname;
      const file = join(dir, pathname);
      const body = await readFile(file);
      res.writeHead(200, { "content-type": contentType(file) });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return server;
}

function contentType(file) {
  if (file.endsWith(".js")) return "text/javascript";
  if (file.endsWith(".css")) return "text/css";
  return "text/html";
}

async function waitForUrl(url) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // retry while server starts
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting ${url}`);
}

async function expectText(page, selector, text) {
  await waitUntil(async () => new RegExp(text).test((await page.locator(selector).textContent()) ?? ""), `text ${text}`);
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function waitUntil(predicate, label) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting ${label}`);
}

async function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("exit", (code) => {
      if (code === 0) resolveRun(stdout + stderr);
      else reject(new Error(`${command} ${args.join(" ")} failed ${code}: ${stdout}${stderr}`));
    });
  });
}
