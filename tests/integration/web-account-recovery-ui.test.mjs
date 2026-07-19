import test from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";
import {
  canonicalRecoveryMessage,
  createRecoveryMaterial,
  decryptRecoveryPrivateKey,
} from "../helpers/recovery-material.mjs";

const root = join(process.cwd(), "apps/web/public");
const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
]);

test("web registration creates master-protected recovery material without sending the master password", async () => {
  const server = await startStaticServer();
  let browser;
  let registerBody;
  const master = "web-registration-master";

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route("**/api/auth/register", async (route) => {
      registerBody = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ token: "test-session", userId: "test-user" }) });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel("Email").fill("web-register@example.test");
    await page.getByLabel("Account password", { exact: true }).fill("web-account-password");
    await page.getByLabel("Master password", { exact: true }).fill(master);
    await page.getByLabel("Confirm master password").fill(master);
    await page.getByRole("button", { name: "Register" }).click();
    await waitUntil(() => Boolean(registerBody), "registration request");

    assert.equal(registerBody.masterPassword, undefined);
    assert.equal(JSON.stringify(registerBody).includes(master), false);
    assert.equal(registerBody.recovery.version, 1);
    assert.equal(registerBody.recovery.envelope.kdf, "PBKDF2-SHA256");
    assert.equal(registerBody.recovery.envelope.iterations, 210000);
    const privateKey = decryptRecoveryPrivateKey(registerBody.recovery.envelope, master);
    const publicKey = createPublicKey({ key: privateKey, type: "pkcs8", format: "der" })
      .export({ type: "spki", format: "der" }).toString("base64");
    assert.equal(publicKey, registerBody.recovery.verifier);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("web forgot-password flow keeps recovery token client-side, rejects wrong master, and rotates recovery", async () => {
  const server = await startStaticServer();
  let browser;
  let completeBody;
  let completeCalls = 0;
  const master = "web-recovery-master-password";
  const initial = createRecoveryMaterial(master);
  const challengeId = "challenge_web_1";
  const challenge = "d2ViLXJlY292ZXJ5LWNoYWxsZW5nZS0wMDAx";

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route("**/api/auth/recovery/challenge", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        protocol: "gvault-recovery-v1",
        challengeId,
        challenge,
        expiresAt: new Date(Date.now() + 300000).toISOString(),
        envelope: initial.recovery.envelope,
      }),
    }));
    await page.route("**/api/auth/recovery/complete", async (route) => {
      completeCalls += 1;
      completeBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "recovered-session", userId: "recovered-user" }) });
    });
    await page.route("**/api/sync/pull", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ serverTime: new Date().toISOString(), records: [], conflicts: [] }),
    }));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel("Email").fill("web-recover@example.test");
    await page.getByRole("button", { name: "Forgot account password?" }).click();
    await page.getByLabel("Master password", { exact: true }).fill("wrong-master-password");
    await page.getByLabel("New account password", { exact: true }).fill("replacement-account-password");
    await page.getByLabel("Confirm new account password", { exact: true }).fill("replacement-account-password");
    await page.getByRole("button", { name: "Recover account" }).click();
    await expectText(page, "#status", "Recovery could not be completed");
    assert.equal(completeCalls, 0, "wrong master fails locally before proof submission");

    await page.getByLabel("Master password", { exact: true }).fill(master);
    await page.getByRole("button", { name: "Recover account" }).click();
    await waitUntil(() => Boolean(completeBody), "recovery completion request");
    await expectText(page, "#status", "Account password reset and vault restored");

    assert.equal(completeBody.masterPassword, undefined);
    assert.equal(JSON.stringify(completeBody).includes(master), false);
    assert.equal(completeBody.challengeId, challengeId);
    assert.equal(completeBody.deviceName, "Web browser");
    assert.notEqual(completeBody.recovery.verifier, initial.recovery.verifier);
    assert.doesNotMatch(JSON.stringify(completeBody), new RegExp(escapeRegex(initial.privateKey.toString("base64"))));
    const publicKey = createPublicKey({ key: Buffer.from(initial.recovery.verifier, "base64"), type: "spki", format: "der" });
    assert.equal(verify(
      "sha256",
      Buffer.from(canonicalRecoveryMessage(challengeId, challenge)),
      publicKey,
      Buffer.from(completeBody.proof, "base64"),
    ), true);
    decryptRecoveryPrivateKey(completeBody.recovery.envelope, master);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

function chromeLaunchOptions() {
  const executablePath = process.env.GV_CHROME_EXECUTABLE || [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find((candidate) => existsSync(candidate));
  return executablePath ? { executablePath } : {};
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    try {
      const file = await readFile(join(root, pathname.replace(/^\/+/, "")));
      response.writeHead(200, { "content-type": contentTypes.get(extname(pathname)) || "application/octet-stream" });
      response.end(file);
    } catch {
      response.writeHead(404).end("not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

async function expectText(page, selector, text) {
  await waitUntil(async () => ((await page.locator(selector).textContent()) || "").includes(text), `text ${text}`);
}

async function waitUntil(predicate, label) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
