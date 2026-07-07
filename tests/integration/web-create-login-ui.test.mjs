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
    await page.locator("[name=password]").fill("new-secret-password");
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
