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
      let totpTick;
      const nativeSetTimeout = window.setTimeout.bind(window);
      Date.now = () => now;
      window.__setTotpTestTime = (value) => { now = value; };
      window.__clipboardWrites = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.__clipboardWrites.push(value);
          },
        },
      });
      window.setTimeout = (callback, delay, ...args) => {
        if (delay > 0 && delay <= 1_000) {
          totpTick = () => callback(...args);
          return 260;
        }
        return nativeSetTimeout(callback, delay, ...args);
      };
      window.__runTotpTestTick = () => {
        const tick = totpTick;
        totpTick = undefined;
        tick?.();
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator("#serverUrl").fill(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole("button", { name: "Register" }).click();
    await unlock(page);

    await page.locator("[name=title]").fill("Existing login");
    await page.locator("[name=username]").fill("existing@example.local");
    await page.getByRole("button", { name: "Save changes" }).click();
    const existingLoginId = await page.locator(".item-row.active").getAttribute("data-id");
    assert.ok(existingLoginId);

    await page.locator("#newItemButton").click();
    await page.getByLabel("Item type").selectOption("authenticator");
    await page.locator("[name=title]").fill("Primary authenticator");
    await page.getByLabel("TOTP secret").fill(rfcSecret);
    await page.getByLabel("Linked Login").selectOption(existingLoginId);
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
    const countdown = page.getByRole("progressbar", { name: "TOTP code time remaining" });
    const announcement = page.locator("#totpAnnouncement");
    await assertText(code, "287082");
    await assertProgress(countdown, 1);
    assert.equal(await announcement.textContent(), "Current TOTP code 287082");
    const copyButton = page.getByRole("button", { name: "Copy current TOTP code", exact: true });
    assert.equal(await copyButton.isEnabled(), true, "copy is enabled with a valid rendered code");
    await copyButton.click();
    assert.deepEqual(await page.evaluate(() => window.__clipboardWrites), [await code.textContent()], "copy uses the rendered output text exactly");
    await assertText(page.locator("#status"), "Current TOTP code copied.");
    assert.equal(await page.locator("#status").getAttribute("data-tone"), "success");
    assert.equal(await announcement.textContent(), "Current TOTP code 287082", "copy feedback does not enter the code-only live region");

    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => { throw new Error("clipboard rejected"); };
    });
    await copyButton.click();
    await assertText(page.locator("#status"), "Could not copy current TOTP code.");
    assert.equal(await page.locator("#status").getAttribute("data-tone"), "warning");
    assert.equal((await page.locator("#status").textContent()).includes("287082"), false, "failure status does not leak the code");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    });
    await copyButton.click();
    await assertText(page.locator("#status"), "Could not copy current TOTP code.");
    assert.equal(await announcement.textContent(), "Current TOTP code 287082", "clipboard failure does not enter the code-only live region");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (value) => { window.__clipboardWrites.push(value); } },
      });
    });
    const staleCopyButton = await copyButton.elementHandle();
    assert.ok(staleCopyButton);
    await page.evaluate(() => { window.__clipboardWrites = []; });
    assert.equal(await countdown.evaluate((node) => Boolean(node.closest("[aria-live]"))), false, "countdown is outside every live region");
    await page.evaluate(() => {
      window.__totpAnnouncementMutations = 0;
      new MutationObserver((records) => { window.__totpAnnouncementMutations += records.length; })
        .observe(document.querySelector("#totpAnnouncement"), { childList: true, characterData: true, subtree: true });
      window.__setTotpTestTime(59_500);
      window.__runTotpTestTick();
    });
    await assertProgress(countdown, 1);
    assert.equal(await announcement.textContent(), "Current TOTP code 287082", "same-code tick keeps live text stable");
    assert.equal(await page.evaluate(() => window.__totpAnnouncementMutations), 0, "same-code tick does not mutate the live region");
    await page.evaluate(() => {
      window.__setTotpTestTime(60_000);
      window.__runTotpTestTick();
    });
    await assertText(code, "359152");
    await assertProgress(countdown, 30);
    assert.equal(await announcement.textContent(), "Current TOTP code 359152", "rollover updates the live code announcement");
    assert.equal(await page.evaluate(() => window.__totpAnnouncementMutations), 1, "rollover mutates the live region once");
    await staleCopyButton.evaluate((button) => button.click());
    assert.deepEqual(await page.evaluate(() => window.__clipboardWrites), [], "a detached pre-rollover copy control cannot copy");
    await page.getByRole("button", { name: "Copy current TOTP code", exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.__clipboardWrites), ["359152"], "the replacement control copies the replacement output");

    await page.locator("#newItemButton").click();
    assert.equal(await copyButton.count(), 0, "deselecting the authenticator clears copy eligibility");
    assert.equal(await code.count(), 0, "deselecting the authenticator clears its code");
    assert.equal(await countdown.count(), 0, "deselecting the authenticator clears its countdown");
    assert.equal(await announcement.textContent(), "", "deselecting clears the code announcement");
    await page.evaluate(() => {
      window.__setTotpTestTime(90_000);
      window.__runTotpTestTick();
    });
    assert.equal(await code.count(), 0, "a stale timer cannot restore a deselected authenticator code");
    assert.equal(await countdown.count(), 0, "a stale timer cannot restore a deselected countdown");

    await page.locator(".item-row").filter({ hasText: "Primary authenticator" }).click();
    await assertText(code, "969429");
    assert.equal(await page.locator(".item-row").filter({ hasText: "Existing login" }).count(), 1, "existing items are unaffected");

    await page.locator(".item-row").filter({ hasText: "Existing login" }).click();
    await assertText(code, "969429");
    await assertProgress(countdown, 30);
    assert.equal(await page.locator("#authenticatorCard").isVisible(), true, "linked Login renders the existing live authenticator UI");

    await page.locator(".item-row").filter({ hasText: "Primary authenticator" }).click();
    await page.getByLabel("Linked Login").selectOption("");
    await page.getByRole("button", { name: "Save changes" }).click();
    await assertText(code, "969429");
    await page.locator(".item-row").filter({ hasText: "Primary authenticator" }).click();
    assert.equal(await page.getByLabel("Linked Login").inputValue(), "", "the relationship can be explicitly cleared");
    await page.locator(".item-row").filter({ hasText: "Existing login" }).click();
    assert.equal(await code.count(), 0, "clearing the relationship fails closed on the Login detail");
    assert.equal(await countdown.count(), 0, "clearing the relationship removes the Login countdown");
    await page.locator(".item-row").filter({ hasText: "Primary authenticator" }).click();
    await assertProgress(countdown, 30);

    await page.getByLabel("TOTP secret").fill("invalid!");
    await page.getByRole("button", { name: "Save changes" }).click();
    await assertText(page.getByRole("alert"), "invalid Base32 TOTP secret");
    assert.equal(await code.count(), 0, "invalid secret removes the prior code");
    assert.equal(await countdown.count(), 0, "invalid secret removes the countdown");
    assert.equal(await copyButton.count(), 0, "invalid secret removes copy eligibility");
    assert.equal(await announcement.textContent(), "", "invalid secret clears the prior live announcement");

    await page.getByRole("button", { name: "Lock now" }).click();
    assert.equal(await copyButton.count(), 0, "locking keeps copy eligibility out of the DOM");
    assert.equal(await code.count(), 0, "locking keeps authenticator code material out of the DOM");
    assert.equal(await countdown.count(), 0, "locking removes the countdown from the DOM");
    assert.equal(await page.locator("input").evaluateAll((inputs, secret) => inputs.some((input) => input.value === secret), rfcSecret), false, "locking clears decrypted secret fields");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("linked authenticator relationships fail closed when stale or ambiguous and duplicate Login titles stay distinguishable", async () => {
  const sync = { records: [], requests: [] };
  const server = await startServer(sync);
  let browser;
  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => { Date.now = () => 59_000; });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await unlock(page);

    await page.locator("[name=title]").fill("Duplicate");
    await page.locator("[name=username]").fill("same@example.local");
    await page.locator("[name=url]").fill("https://same.example.local");
    await page.getByRole("button", { name: "Save changes" }).click();
    const firstLoginId = await page.locator(".item-row.active").getAttribute("data-id");
    assert.ok(firstLoginId);

    await page.locator("#newItemButton").click();
    await page.locator("[name=title]").fill("Duplicate");
    await page.locator("[name=username]").fill("same@example.local");
    await page.locator("[name=url]").fill("https://same.example.local");
    await page.getByRole("button", { name: "Save changes" }).click();
    const secondLoginId = await page.locator(".item-row.active").getAttribute("data-id");
    assert.ok(secondLoginId);

    await page.locator("#newItemButton").click();
    await page.getByLabel("Item type").selectOption("authenticator");
    const loginOptions = page.getByLabel("Linked Login").locator("option:not([value=''])");
    const optionLabels = await loginOptions.allTextContents();
    const optionValues = await loginOptions.evaluateAll((options) => options.map((option) => option.value));
    assert.equal(new Set(optionLabels).size, optionLabels.length, "identical Login metadata still has distinct non-secret option labels");
    assert.deepEqual(new Set(optionValues), new Set([firstLoginId, secondLoginId]), "option values remain the exact Login IDs");
    assert.equal(optionLabels.every((label) => label.includes("same@example.local")), true);
    assert.equal(optionLabels.some((label) => label.endsWith(firstLoginId.slice(0, 8))), true);
    assert.equal(optionLabels.some((label) => label.endsWith(secondLoginId.slice(0, 8))), true);
    await page.locator("[name=title]").fill("First authenticator");
    await page.getByLabel("TOTP secret").fill(rfcSecret);
    await page.getByLabel("Linked Login").selectOption(firstLoginId);
    await page.getByRole("button", { name: "Save changes" }).click();

    await page.locator("#newItemButton").click();
    await page.getByLabel("Item type").selectOption("authenticator");
    await page.locator("[name=title]").fill("Second authenticator");
    await page.getByLabel("TOTP secret").fill(rfcSecret);
    await page.getByLabel("Linked Login").selectOption(firstLoginId);
    await page.getByRole("button", { name: "Save changes" }).click();
    await assertText(page.getByLabel("Current TOTP code"), "287082", 5_000);

    await page.locator(`.item-row[data-id="${firstLoginId}"]`).click();
    assert.equal(await page.getByLabel("Current TOTP code").count(), 0, "multiple linked authenticators expose no code");
    assert.equal(await page.getByRole("progressbar", { name: "TOTP code time remaining" }).count(), 0);
    assert.equal(await page.locator("#authenticatorCard").isVisible(), false, "ambiguous relationship hides the TOTP block");

    await page.locator(".item-row").filter({ hasText: "Second authenticator" }).click();
    await page.getByLabel("Linked Login").evaluate((select) => {
      select.add(new Option("Missing Login", "missing-login-id"));
      select.value = "missing-login-id";
    });
    await page.getByRole("button", { name: "Save changes" }).click();
    await assertText(page.getByLabel("Current TOTP code"), "287082", 5_000);
    await page.locator(".item-row").filter({ hasText: "Second authenticator" }).click();
    assert.equal(await page.getByLabel("Linked Login").inputValue(), "", "stale Login IDs render as unlinked instead of inferring a target");
    await page.locator(`.item-row[data-id="${firstLoginId}"]`).click();
    await assertText(page.getByLabel("Current TOTP code"), "287082", 5_000);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

async function unlock(page) {
  await page.getByLabel("Master password").fill("local-master-password");
  await page.getByRole("button", { name: "Unlock vault" }).click();
}

async function assertProgress(locator, expected) {
  await locator.waitFor({ state: "attached" });
  assert.equal(await locator.getAttribute("aria-valuemin"), "0");
  assert.equal(await locator.getAttribute("aria-valuemax"), "30");
  assert.equal(await locator.getAttribute("aria-valuenow"), String(expected));
  assert.equal(await locator.getAttribute("aria-valuetext"), `${expected} seconds remaining`);
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
