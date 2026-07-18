import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const liveBaseUrl = process.env.GV_WEB_E2E_URL || "https://gvault.guber.dev";

test("web client works against the live GVault service", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `web-e2e-${runId}@example.local`;
  const accountPassword = `web-e2e-password-${runId}`;
  const masterPassword = `web-e2e-master-${runId}`;
  const title = `Web E2E Login ${runId}`;

  try {
    const health = await (await fetch(new URL("/healthz", liveBaseUrl))).json();
    assert.equal(health.ok, true, "live GVault health endpoint reports ok");
    assert.equal(health.product, "GVault", "live health endpoint is the GVault service");

    await page.goto(liveBaseUrl);
    await expectText(page, "body", "Unlock GVault");
    await expectText(page, "#status", "Connect a server");
    await assertServerInput(page, liveBaseUrl);

    await page.getByRole("button", { name: "Dark mode" }).click();
    await expectText(page, "#themeButton", "Light mode");
    await page.getByRole("button", { name: "Light mode" }).click();
    await expectText(page, "#themeButton", "Dark mode");

    await page.locator("#email").fill(email);
    await page.locator("#accountPassword").fill(accountPassword);
    await page.getByLabel("Master password", { exact: true }).fill(masterPassword);
    await page.getByLabel("Confirm master password").fill(masterPassword);
    await page.getByRole("button", { name: "Register" }).click();
    await expectText(page, "#lockState", "Unlocked");
    await expectText(page, "#status", "Server session ready");

    await page.locator("[name=title]").fill(title);
    await page.locator("[name=url]").fill("https://example.com/login");
    await page.locator("[name=username]").fill(email);
    await page.locator("[name=password]").fill("saved-password-from-web-e2e");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expectText(page, "#detailTitle", title);
    assert.equal(await page.locator(".item-row").count(), 1, "new login item appears in the web vault list");

    await page.getByLabel("Search vault").fill(title);
    assert.equal(await page.locator(".item-row").count(), 1, "web vault search finds the created login item");

    await page.locator("#syncButton").click();
    await expectText(page, "#status", "Sync complete: 1 pushed");

    await page.locator("#lockButton").click();
    await expectText(page, "#lockState", "Locked");
    await page.reload();
    await expectText(page, "#status", "Connect a server");
    await assertServerInput(page, liveBaseUrl);

    await page.locator("#email").fill(email);
    await page.locator("#accountPassword").fill(accountPassword);
    await page.locator("#loginButton").click();
    await expectText(page, "#status", "Server session");

    await page.getByLabel("Master password", { exact: true }).fill(masterPassword);
    await page.getByRole("button", { name: "Unlock vault" }).click();
    await page.locator("#syncButton").click();
    await expectText(page, "#status", "Sync complete");
    await page.getByLabel("Search vault").fill(title);
    await expectText(page, "#items", title);

    await page.setViewportSize({ width: 390, height: 900 });
    await expectText(page, "body", "GVault");
    await expectText(page, "#lockState", "Unlocked");
  } finally {
    await browser.close();
  }
});

async function assertServerInput(page, expectedUrl) {
  const actual = await page.locator("#serverUrl").inputValue();
  assert.equal(new URL(actual).origin, new URL(expectedUrl).origin, "web client points at the live GVault server");
}

async function expectText(page, selector, text) {
  await waitUntil(async () => new RegExp(escapeRegExp(text)).test((await page.locator(selector).textContent()) ?? ""), `text ${text}`);
}

async function waitUntil(predicate, label) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting ${label}`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
