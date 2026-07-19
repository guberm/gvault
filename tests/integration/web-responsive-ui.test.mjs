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

test("web shell exposes only usable controls and keeps the unlocked workspace inside every supported viewport", async () => {
  const server = await startStaticServer();
  let browser;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    await page.goto(baseUrl);
    await page.locator("#serverUrl").fill(baseUrl);

    assert.equal(await page.locator("#vaultNavigation").count(), 1, "vault-only navigation has an explicit visibility boundary");
    assert.equal(await page.locator("#vaultNavigation").isHidden(), true, "locked users see the auth-first surface, not vault tools");
    assert.equal(await page.locator('link[rel="stylesheet"]').getAttribute("href"), "./styles.css?v=501", "UI polish stylesheet bypasses stale CDN assets");
    assert.equal(await page.locator('script[type="module"]').getAttribute("src"), "./app.js?v=501", "UI behavior bypasses stale CDN assets");
    assert.equal(await page.getByRole("button", { name: "Export vault" }).count(), 0, "unfinished export is not presented as a working action");
    assert.equal(await page.getByRole("button", { name: "More" }).count(), 0, "unfinished item menu is not presented as a working action");

    await page.setViewportSize({ width: 1440, height: 900 });
    const headerLayout = await page.evaluate(() => {
      const header = document.querySelector(".server-bar").getBoundingClientRect();
      const accountLabel = document.querySelector("#emailLabel");
      return {
        fits: [...document.querySelectorAll(".server-bar > *")].every((child) => {
          const rect = child.getBoundingClientRect();
          return rect.left >= header.left && rect.right <= header.right;
        }),
        accountLineHeight: accountLabel.getBoundingClientRect().height,
      };
    });
    assert.equal(headerLayout.fits, true, "desktop connection controls stay inside the server bar");
    assert.ok(headerLayout.accountLineHeight < 24, "desktop account status stays on one readable line");

    await page.getByLabel("Master password", { exact: true }).fill("local-master-password");
    await page.getByRole("button", { name: "Unlock vault" }).click();
    assert.equal(await page.locator("#vaultNavigation").isVisible(), true, "vault navigation becomes available after unlock");

    for (const width of [1600, 1280, 1100, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        mobileNavColumns: getComputedStyle(document.querySelector(".nav-list")).gridTemplateColumns.split(" ").length,
      }));
      assert.ok(layout.scrollWidth <= layout.innerWidth, `unlocked Web UI does not overflow at ${width}px`);
      if (width === 390) assert.equal(layout.mobileNavColumns, 2, "mobile vault categories remain compact");
    }

    await page.getByRole("button", { name: "Password generator" }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "generateButton", "generator navigation lands on an actionable control");

    await page.getByRole("button", { name: "Health check" }).click();
    await page.locator("#status").filter({ hasText: "Server healthy" }).waitFor();
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
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/healthz") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: true, product: "GVault" }));
      return;
    }
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
