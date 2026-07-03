import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { chromium } from "playwright";

const root = resolve(".");
const results = [];

try {
  const serverPort = 21080 + Math.floor(Math.random() * 1000);
  const webPort = serverPort + 1;
  const dataDir = await mkdtemp(join(tmpdir(), "gvault-e2e-"));
  const api = spawn(process.execPath, ["apps/server/dist/index.js"], {
    cwd: root,
    env: { ...process.env, GV_DATA_DIR: dataDir, GV_SERVER_HOST: "127.0.0.1", GV_SERVER_PORT: String(serverPort), GV_ALLOWED_ORIGINS: "*" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForUrl(`http://127.0.0.1:${serverPort}/healthz`);
  results.push("server health ok");

  const web = await serveStatic(join(root, "apps/web/dist"), webPort);
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

  api.kill();
  await closeServer(web);
  console.log(results.join("\n"));
} catch (error) {
  console.error(results.join("\n"));
  throw error;
}

async function webClientE2e(webPort, serverPort) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${webPort}/`);
    await page.getByLabel("Server").fill(`http://127.0.0.1:${serverPort}`);
    await page.getByLabel("Email").fill(`e2e-${Date.now()}@example.local`);
    await page.getByLabel("Account password").fill("change-me-strong-password");
    await page.getByRole("button", { name: "Register" }).click();
    await page.getByLabel("Master password").fill("correct horse battery staple");
    await page.getByRole("button", { name: "Unlock local vault" }).click();
    await page.locator("[name=title]").fill("Example Login");
    await page.locator("[name=url]").fill("https://example.com/login");
    await page.locator("[name=username]").fill("demo@example.com");
    await page.getByRole("button", { name: "Generate" }).click();
    await page.getByRole("button", { name: "Save login" }).click();
    await page.getByLabel("Search vault").fill("Example");
    await waitUntil(async () => (await page.locator(".item").count()) === 1, "saved item appears");
    await page.getByRole("button", { name: "Sync" }).click();
    await expectText(page, "#status", "Sync endpoint reachable");
  } finally {
    await browser.close();
  }
}

async function chromeExtensionE2e(webPort) {
  await chromiumExtensionE2e(webPort, join(root, "apps/browser-extension/dist/chrome"));
}

async function edgeExtensionE2e(webPort) {
  const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  if (!existsSync(edge)) return;
  await chromiumExtensionE2e(webPort, join(root, "apps/browser-extension/dist/edge"), edge);
}

async function chromiumExtensionE2e(webPort, extensionPath, executablePath) {
  const userDataDir = await mkdtemp(join(tmpdir(), "gvault-ext-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });
  try {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) serviceWorker = await context.waitForEvent("serviceworker", { timeout: 10000 });
    const extensionId = serviceWorker.url().split("/")[2];
    assert.ok(extensionId);

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
    await expectText(popup, "body", "GVault");
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
  if (!existsSync(binary)) throw new Error("Linux GVault binary missing");
  const linuxPath = `/mnt/${binary[0].toLowerCase()}${binary.slice(2).replaceAll("\\", "/")}`;
  await run("wsl.exe", ["bash", "-lc", `chmod +x '${linuxPath}' && '${linuxPath}' | grep -q 'GVault desktop preview'`]);
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("exit", (code) => {
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} failed with ${code}: ${stderr}`));
    });
  });
}

async function serveStatic(dir, port) {
  const server = createServer(async (req, res) => {
    if (req.url === "/login-test.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<form><input id="username" type="text" autocomplete="username"><input id="password" type="password"><button>Login</button></form>`);
      return;
    }
    const path = req.url === "/" ? "/index.html" : new URL(req.url, "http://localhost").pathname;
    const file = join(dir, path);
    try {
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
  return extname(file) === ".js" ? "text/javascript" : extname(file) === ".css" ? "text/css" : "text/html";
}

async function waitForUrl(url) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
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
  throw new Error(`Timed out waiting for ${label}`);
}
