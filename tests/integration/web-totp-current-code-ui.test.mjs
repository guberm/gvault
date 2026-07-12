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
const rfcSecret = String.fromCharCode(...[
  71, 69, 90, 68, 71, 78, 66, 86, 71, 89, 51, 84, 81, 79, 74, 81,
  71, 69, 90, 68, 71, 78, 66, 86, 71, 89, 51, 84, 81, 79, 74, 81,
]);

test("selected encrypted vault authenticator displays the current RFC 6238 code", async () => {
  const sync = { records: [], requests: [] };
  const server = await startServer(sync);
  let browser;
  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      let now = 59_000;
      Date.now = () => now;
      window.__setTotpTestTime = (value) => { now = value; };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator("#serverUrl").fill(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole("button", { name: "Register" }).click();
    await unlock(page);

    await page.locator("[name=title]").fill("Existing login");
    await page.locator("[name=username]").fill("existing@example.local");
    await page.getByRole("button", { name: "Save changes" }).click();

    await page.locator("#newItemButton").click();
    await page.getByLabel("Item type").selectOption("authenticator");
    await page.locator("[name=title]").fill("Primary authenticator");
    await page.getByLabel("TOTP secret").fill(rfcSecret);
    await page.getByRole("button", { name: "Save changes" }).click();
    await assertText(page.getByLabel("Current TOTP code"), "287082");
    assert.equal(await page.locator(".item-row").count(), 2, "authenticator uses the canonical vault item list");
    assert.equal((await page.locator("body").innerText()).includes(rfcSecret), false, "secret is absent from visible text");
    assert.equal((await page.locator("#status").innerText()).includes(rfcSecret), false, "secret is absent from status text");

    await page.getByRole("button", { name: "Sync" }).click();
    await assertText(page.locator("#status"), "Sync complete: 2 pushed");
    const push = sync.requests.find((request) => request.path === "/api/sync/push");
    assert.ok(push, "encrypted records were pushed");
    assert.equal(push.raw.includes(rfcSecret), false, "plaintext TOTP secret is absent from the sync request");
    assert.equal(push.raw.includes("287082"), false, "current code is absent from the sync request");
    assert.equal(push.body.records.every((record) => typeof record.ciphertext === "string" && !record.title && !record.secret), true);
    assert.equal(sync.records.length, 2, "server push response state retains all user records");
    assert.equal(sync.records.every((record) => record.ownerId === "test-user"), true, "server normalizes every accepted record owner");

    await page.reload();
    await page.locator("#serverUrl").fill(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await unlock(page);
    await page.getByRole("button", { name: "Sync" }).click();
    await assertText(page.locator("#status"), "Sync complete: 0 pushed, 2 imported", 5_000);
    await page.locator(".item-row").filter({ hasText: "Primary authenticator" }).click();
    const code = page.getByLabel("Current TOTP code");
    await assertText(code, "287082");
    await page.evaluate(() => window.__setTotpTestTime(60_000));
    await assertText(code, "359152", 2_000);

    await page.locator("#newItemButton").click();
    assert.equal(await code.count(), 0, "deselecting the authenticator clears its code");
    await page.evaluate(() => window.__setTotpTestTime(90_000));
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    assert.equal(await code.count(), 0, "a stale timer cannot restore a deselected authenticator code");

    await page.locator(".item-row").filter({ hasText: "Primary authenticator" }).click();
    await assertText(code, "969429");
    assert.equal(await page.locator(".item-row").filter({ hasText: "Existing login" }).count(), 1, "existing items are unaffected");

    await page.getByRole("button", { name: "Lock now" }).click();
    assert.equal(await code.count(), 0, "locking keeps authenticator code material out of the DOM");
    assert.equal(await page.locator("input").evaluateAll((inputs, secret) => inputs.some((input) => input.value === secret), rfcSecret), false, "locking clears decrypted secret fields");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

async function unlock(page) {
  await page.getByLabel("Master password").fill("local-master-password");
  await page.getByRole("button", { name: "Unlock vault" }).click();
}

async function assertText(locator, expected, timeout = 1_000) {
  const deadline = performance.now() + timeout;
  while (performance.now() <= deadline) {
    if ((await locator.textContent().catch(() => ""))?.includes(expected)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`Expected text ${JSON.stringify(expected)}; received ${JSON.stringify(await locator.textContent().catch(() => null))}`);
}

async function startServer(sync) {
  return new Promise((resolve) => {
    const server = createServer(async (request, response) => {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname.startsWith("/api/")) {
        const raw = await new Promise((done) => {
          let value = "";
          request.setEncoding("utf8");
          request.on("data", (chunk) => { value += chunk; });
          request.on("end", () => done(value));
        });
        const body = raw ? JSON.parse(raw) : {};
        sync.requests.push({ path: url.pathname, raw, body });
        if (url.pathname === "/api/auth/register" || url.pathname === "/api/auth/login") return json(response, { token: "test-token", userId: "test-user" });
        if (url.pathname === "/api/sync/push") {
          const incoming = Array.isArray(body.records) ? body.records.map((record) => assertEncryptedRecord(record, "test-user")) : [];
          const existing = sync.records.filter((record) => record.ownerId === "test-user");
          const conflicts = detectConflicts(existing, incoming);
          const conflictIds = new Set(conflicts.map((record) => record.id));
          for (const record of incoming.filter((candidate) => !conflictIds.has(candidate.id))) {
            const index = sync.records.findIndex((candidate) => candidate.ownerId === "test-user" && candidate.id === record.id);
            if (index >= 0) sync.records[index] = record;
            else sync.records.push(record);
          }
          return json(response, {
            serverTime: new Date().toISOString(),
            records: sync.records.filter((record) => record.ownerId === "test-user"),
            conflicts,
          });
        }
        if (url.pathname === "/api/sync/pull") return json(response, {
          serverTime: new Date().toISOString(),
          records: sync.records.filter((record) => record.ownerId === "test-user"),
          conflicts: [],
        });
        return json(response, { error: "not found" }, 404);
      }
      const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const file = join(root, relative);
      if (!existsSync(file) || !file.startsWith(root)) {
        response.writeHead(404).end("not found");
        return;
      }
      response.writeHead(200, { "content-type": contentTypes.get(extname(file)) || "application/octet-stream" });
      response.end(await readFile(file));
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function assertEncryptedRecord(value, ownerId) {
  if (!value || typeof value !== "object") throw new Error("Invalid encrypted record");
  for (const field of ["id", "deviceId", "collection", "ciphertext", "nonce", "updatedAt"]) {
    if (typeof value[field] !== "string") throw new Error(`Encrypted record ${field} is required`);
  }
  if (!["vault-items", "attachments", "metadata"].includes(value.collection)) throw new Error("Encrypted record collection is invalid");
  return {
    id: value.id,
    ownerId,
    deviceId: value.deviceId,
    collection: value.collection,
    ciphertext: value.ciphertext,
    nonce: value.nonce,
    salt: value.salt,
    schemaVersion: Number(value.schemaVersion ?? 1),
    deleted: Boolean(value.deleted),
    updatedAt: value.updatedAt,
    revision: Number(value.revision ?? 1),
  };
}

function detectConflicts(existing, incoming) {
  const byId = new Map(existing.map((record) => [record.id, record]));
  return incoming.filter((record) => {
    const current = byId.get(record.id);
    return current && current.revision >= record.revision && current.ciphertext !== record.ciphertext;
  });
}

function json(response, body, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function chromeLaunchOptions() {
  const executablePath = process.env.GV_CHROME_PATH;
  return executablePath ? { executablePath, headless: true } : { headless: true };
}
