import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(".");
const firefoxExtensionPath = join(root, "apps/browser-extension/dist/firefox");
const extensionId = "extension@gvault.local";
const extensionUuid = "00000000-0000-4000-8000-00000000a482";

test("Firefox packaged extension loads and autofills a matching login", { skip: !firefoxExecutable() && "Mozilla Firefox executable not found" }, async () => {
  assert.ok(existsSync(firefoxExtensionPath), "Firefox extension build exists");
  const manifest = JSON.parse(await readFile(join(firefoxExtensionPath, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3, "Firefox extension is Manifest V3");
  assert.equal(manifest.name, "GVault for Firefox", "Firefox build uses Firefox-specific product name");
  assert.equal(manifest.browser_specific_settings?.gecko?.id, extensionId, "Firefox build has a stable Gecko id");

  const temp = await mkdtemp(join(tmpdir(), "gvault-firefox-extension-"));
  const xpi = await buildXpi(temp);
  const webPort = 26080 + Math.floor(Math.random() * 500);
  const driverPort = 27080 + Math.floor(Math.random() * 500);
  const web = await serveLoginPage(webPort);
  const driver = startGeckoDriver(driverPort);
  let sessionId = "";

  try {
    await waitForDriver(driverPort, driver);
    const session = await webdriver(driverPort, "/session", {
      capabilities: {
        alwaysMatch: {
          browserName: "firefox",
          "moz:firefoxOptions": {
            binary: firefoxExecutable(),
            args: ["-headless"],
            prefs: {
              "extensions.webextensions.uuids": JSON.stringify({ [extensionId]: extensionUuid }),
              "network.proxy.type": 0,
              "xpinstall.signatures.required": false
            }
          }
        }
      }
    });
    sessionId = session.sessionId;
    assert.ok(sessionId, "Firefox WebDriver session created");

    const installedId = await webdriver(driverPort, `/session/${sessionId}/moz/addon/install`, { path: xpi, temporary: true });
    assert.equal(installedId, extensionId, "packaged Firefox extension installed as a temporary add-on");

    await webdriver(driverPort, `/session/${sessionId}/url`, { url: `moz-extension://${extensionUuid}/options.html` });
    const loadedName = await execute(driverPort, sessionId, "return chrome.runtime.getManifest().name;");
    assert.equal(loadedName, "GVault for Firefox", "real Firefox loaded the packaged extension runtime");

    const loginUrl = `http://127.0.0.1:${webPort}/login-test.html`;
    await executeAsync(driverPort, sessionId, `
      const done = arguments[arguments.length - 1];
      const login = {
        host: "127.0.0.1",
        url: "${loginUrl}",
        username: "firefox-extension-user",
        password: "firefox-extension-pass",
        matchMode: "exact-host",
        at: new Date().toISOString()
      };
      chrome.storage.session.set({ sessionAutofill: login, sessionAutofillLogins: [login] })
        .then(() => done(true), (error) => done({ error: String(error) }));
    `);

    await webdriver(driverPort, `/session/${sessionId}/url`, { url: loginUrl });
    await waitUntil(async () => (await execute(driverPort, sessionId, "return document.querySelector('#email')?.value || '';")) === "firefox-extension-user", "Firefox extension autofill");
    assert.equal(await execute(driverPort, sessionId, "return document.querySelector('#password').value;"), "firefox-extension-pass");
    assert.equal(await execute(driverPort, sessionId, "return document.querySelector('#search').value;"), "", "Firefox extension does not fill non-credential fields");
  } finally {
    try {
      if (sessionId) await webdriver(driverPort, `/session/${sessionId}`, undefined, "DELETE", 5000).catch(() => {});
    } finally {
      stopGeckoDriver(driver);
    }
    await closeServer(web);
    await rm(temp, { recursive: true, force: true });
  }
});

function firefoxExecutable() {
  if (process.env.GV_FIREFOX_EXECUTABLE) return process.env.GV_FIREFOX_EXECUTABLE;
  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
        "C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe"
      ]
    : process.platform === "darwin"
      ? ["/Applications/Firefox.app/Contents/MacOS/firefox"]
      : ["/usr/bin/firefox", "/usr/bin/firefox-esr"];
  return candidates.find((candidate) => existsSync(candidate));
}

async function buildXpi(artifactsDir) {
  const { command, args } = npxCommand(["--yes", "web-ext", "build", "--source-dir", firefoxExtensionPath, "--artifacts-dir", artifactsDir, "--overwrite-dest"]);
  const result = spawnSync(command, args, { encoding: "utf8" });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout || "web-ext build failed");
  const file = (await readdir(artifactsDir)).find((name) => /\.(xpi|zip)$/.test(name));
  assert.ok(file, "web-ext produced a packaged extension archive");
  return join(artifactsDir, file);
}

function startGeckoDriver(port) {
  const { command, args } = npxCommand(["--yes", "geckodriver", "--port", String(port)]);
  return spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
}

function stopGeckoDriver(driver) {
  if (process.platform === "win32" && driver.pid) {
    spawnSync("taskkill", ["/pid", String(driver.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    driver.kill("SIGTERM");
  }
  driver.stdout?.destroy();
  driver.stderr?.destroy();
}

function npxCommand(args) {
  return process.platform === "win32"
    ? { command: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", "npx", ...args] }
    : { command: "npx", args };
}

async function waitForDriver(port, processHandle) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`geckodriver exited with ${processHandle.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/status`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error("Timed out waiting for geckodriver");
}

async function webdriver(port, path, body, method = "POST", timeoutMs = 30000) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.value?.error) throw new Error(payload.value?.message || `WebDriver ${method} ${path} failed: ${response.status}`);
  return payload.value;
}

async function execute(port, sessionId, script) {
  return webdriver(port, `/session/${sessionId}/execute/sync`, { script, args: [] });
}

async function executeAsync(port, sessionId, script) {
  const result = await webdriver(port, `/session/${sessionId}/execute/async`, { script, args: [] });
  if (result?.error) throw new Error(result.error);
  return result;
}

async function serveLoginPage(port) {
  const server = createServer((req, res) => {
    if (req.url === "/login-test.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html><html><body><form>
        <label>Search <input id="search" name="q"></label>
        <label>Email <input id="email" name="email" type="email" autocomplete="email"></label>
        <label>Password <input id="password" name="password" type="password" autocomplete="current-password"></label>
        <button>Login</button>
      </form></body></html>`);
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });
  await new Promise((resolveListen) => server.listen(port, "127.0.0.1", resolveListen));
  return server;
}

async function waitUntil(predicate, label) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function closeServer(server) {
  await new Promise((resolveClose) => server.close(resolveClose));
}
