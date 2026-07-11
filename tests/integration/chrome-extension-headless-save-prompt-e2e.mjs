import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(".");
const extensionPath = join(root, "apps/browser-extension/dist/chrome");

test("headless Chrome CDP loads extension and shows save-new-login prompt", { skip: !chromeExecutable() && "Google Chrome executable not found" }, async () => {
  await withLoadedExtension(async ({ context, extensionId, port }) => {
    const page = await context.newPage();
    const loginUrl = `http://127.0.0.1:${port}/login-test.html`;
    await page.goto(loginUrl);
    await page.waitForSelector("input[type=password]");

    await page.locator("#email").fill("headless-capture@example.test");
    await page.locator("#password").fill("headless-capture-pass");
    await page.locator("form").evaluate((form) => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expectText(popup, "#savePrompt", "Save login for 127.0.0.1");
    await expectText(popup, "#savePrompt", "headless-capture@example.test");
    assert.equal(await popup.locator("#username").inputValue(), "headless-capture@example.test");
    assert.equal(await popup.locator("#password").inputValue(), "headless-capture-pass");
  });
});

test("headless Chrome CDP shows update-password prompt for changed known login", { skip: !chromeExecutable() && "Google Chrome executable not found" }, async () => {
  await withLoadedExtension(async ({ context, extensionId, port }) => {
    const setupPopup = await context.newPage();
    await setupPopup.goto(`chrome-extension://${extensionId}/popup.html`);
    await setupPopup.evaluate(async () => {
      await chrome.storage.session.set({
        sessionAutofill: {
          host: "127.0.0.1",
          username: "known-login@example.test",
          password: "old-known-password",
          at: new Date().toISOString()
        }
      });
    });
    await setupPopup.close();

    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/login-test.html`);
    await page.waitForSelector("input[type=password]");
    await page.locator("#email").fill("known-login@example.test");
    await page.locator("#password").fill("new-known-password");
    await page.locator("form").evaluate((form) => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expectText(popup, "#savePrompt", "Update password for 127.0.0.1");
    await expectText(popup, "#savePrompt", "known-login@example.test");
    assert.equal(await popup.locator("#username").inputValue(), "known-login@example.test");
    assert.equal(await popup.locator("#password").inputValue(), "new-known-password");
  });
});

test("headless Chrome CDP fills a generated password through popup, worker, and content script", { skip: !chromeExecutable() && "Google Chrome executable not found" }, async () => {
  await withLoadedExtension(async ({ context, extensionId, port }) => {
    const registration = await context.newPage();
    await registration.goto(`http://127.0.0.1:${port}/registration-test.html`);
    await registration.waitForSelector("#new-password");
    await registration.locator("#new-password").click();
    assert.equal(await registration.evaluate(() => document.activeElement?.id), "new-password", "trusted click leaves the authorized target active before popup opens");

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    assert.equal(await registration.evaluate(() => document.activeElement?.id), "new-password", "opening the extension popup preserves the clicked page target as activeElement");
    await popup.locator("#generatePassword").click();
    const generated = await popup.locator("#generatedPassword").inputValue();
    assert.equal(generated.length, 20);
    assert.equal(await registration.locator("#new-password").inputValue(), "", "generation alone must not mutate the page");
    assert.equal(await registration.locator("#confirmation").inputValue(), "");

    await registration.bringToFront();
    await popup.evaluate(() => document.querySelector("#fillGeneratedPassword").click());
    await waitUntil(async () => (await registration.locator("#new-password").inputValue()) === generated, "generated password fill");

    assert.equal(await registration.locator("#confirmation").inputValue(), "", "one explicit action fills exactly one focused field");
    for (const id of ["visibility-hidden-password", "inert-password", "hidden-ancestor-password", "inert-ancestor-password", "transparent-password", "near-transparent-password", "aria-hidden-password", "clip-path-password", "clipped-ancestor-password"]) {
      assert.equal(await registration.locator(`#${id}`).inputValue(), "", `${id} must not receive the generated secret`);
    }
    assert.equal(await registration.locator("#email").inputValue(), "unchanged@example.test");
    assert.equal(await registration.evaluate(() => globalThis.__submitted), false);
    assert.equal((await popup.locator("#status").textContent()).includes(generated), false, "popup status must not reveal the generated password");
  });
});

test("headless unpacked extension refuses generated-password fill without a safe explicit focus target", { skip: !chromeExecutable() && "Google Chrome executable not found" }, async () => {
  await withLoadedExtension(async ({ context, extensionId, port }) => {
    const registration = await context.newPage();
    await registration.goto(`http://127.0.0.1:${port}/registration-test.html`);
    await registration.waitForSelector("#new-password");

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.locator("#generatePassword").click();
    await registration.bringToFront();
    await popup.evaluate(() => document.querySelector("#fillGeneratedPassword").click());
    await expectText(popup, "#status", "Click directly in a visible password field on the page first");

    for (const id of ["new-password", "confirmation", "near-transparent-password", "aria-hidden-password", "clip-path-password", "clipped-ancestor-password"]) {
      assert.equal(await registration.locator(`#${id}`).inputValue(), "", `${id} must remain empty without explicit focus`);
    }

    await registration.locator("#new-password").click();
    await registration.locator("#new-password").evaluate((input) => { input.parentElement.inert = true; });
    await registration.bringToFront();
    await popup.evaluate(() => document.querySelector("#fillGeneratedPassword").click());
    await expectText(popup, "#status", "Click directly in a visible password field on the page first");
    assert.equal(await registration.locator("#new-password").inputValue(), "", "focused target made inert must fail closed");
    assert.equal(await registration.locator("#confirmation").inputValue(), "", "failure must not fall back to another password field");
  });
});

test("headless unpacked extension rejects clicked targets with low effective opacity through the real popup path", { skip: !chromeExecutable() && "Google Chrome executable not found" }, async () => {
  await withLoadedExtension(async ({ context, extensionId, port }) => {
    const registration = await context.newPage();
    await registration.goto(`http://127.0.0.1:${port}/registration-test.html`);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.locator("#generatePassword").click();

    for (const id of ["near-transparent-password", "translucent-ancestor-password"]) {
      await registration.bringToFront();
      await registration.locator(`#${id}`).click({ force: true });
      await registration.bringToFront();
      await popup.evaluate(() => document.querySelector("#fillGeneratedPassword").click());
      await expectText(popup, "#status", "Click directly in a visible password field on the page first");
      assert.equal(await registration.locator(`#${id}`).inputValue(), "", `${id} must remain empty`);
    }
  });
});

test("headless unpacked extension rejects synthetic/programmatic authorization and stale CSS visibility", { skip: !chromeExecutable() && "Google Chrome executable not found" }, async () => {
  await withLoadedExtension(async ({ context, extensionId, port }) => {
    const registration = await context.newPage();
    await registration.goto(`http://127.0.0.1:${port}/registration-test.html`);
    await registration.waitForSelector("#new-password");
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.locator("#generatePassword").click();

    for (const attack of ["synthetic-focusin", "programmatic-focus"]) {
      await registration.bringToFront();
      await registration.evaluate((kind) => {
        const trap = document.querySelector("#clip-path-password");
        if (kind === "synthetic-focusin") trap.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        if (kind === "programmatic-focus") trap.focus();
      }, attack);
      await registration.bringToFront();
      await popup.evaluate(() => document.querySelector("#fillGeneratedPassword").click());
      await expectText(popup, "#status", "Click directly in a visible password field on the page first");
      assert.equal(await registration.locator("#clip-path-password").inputValue(), "", attack);
    }

    for (const mutation of ["visibility-hidden", "display-none", "opacity-low", "ancestor-opacity-low", "ancestor-display-none"]) {
      await registration.reload();
      await registration.locator("#new-password").click();
      await registration.evaluate((kind) => {
        const target = document.querySelector("#new-password");
        if (kind === "visibility-hidden") target.style.visibility = "hidden";
        if (kind === "display-none") target.style.display = "none";
        if (kind === "opacity-low") target.style.opacity = "0.001";
        if (kind === "ancestor-opacity-low") target.parentElement.style.opacity = "0.49";
        if (kind === "ancestor-display-none") target.parentElement.style.display = "none";
      }, mutation);
      await registration.bringToFront();
      await popup.evaluate(() => document.querySelector("#fillGeneratedPassword").click());
      await expectText(popup, "#status", "Click directly in a visible password field on the page first");
      assert.equal(await registration.locator("#new-password").inputValue(), "", mutation);
      assert.equal(await registration.locator("#confirmation").inputValue(), "", `${mutation} must not fall back`);
    }
  });
});

test("headless unpacked extension rejects label forwarding, synthetic pointers, and a later overlay", { skip: !chromeExecutable() && "Google Chrome executable not found" }, async () => {
  await withLoadedExtension(async ({ context, extensionId, port }) => {
    const registration = await context.newPage();
    await registration.goto(`http://127.0.0.1:${port}/registration-test.html`);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.locator("#generatePassword").click();

    const labelBox = await registration.locator('label[for="new-password"]').boundingBox();
    assert.ok(labelBox, "label has a clickable box");
    await registration.mouse.click(labelBox.x + 2, labelBox.y + (labelBox.height / 2));
    assert.equal(await registration.evaluate(() => document.activeElement?.id), "new-password", "Chrome forwarded label activation focuses the control");
    await registration.bringToFront();
    await popup.evaluate(() => document.querySelector("#fillGeneratedPassword").click());
    await expectText(popup, "#status", "Click directly in a visible password field on the page first");
    assert.equal(await registration.locator("#new-password").inputValue(), "");

    await registration.evaluate(() => {
      const target = document.querySelector("#new-password");
      target.focus();
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });
    await registration.bringToFront();
    await popup.evaluate(() => document.querySelector("#fillGeneratedPassword").click());
    await expectText(popup, "#status", "Click directly in a visible password field on the page first");
    assert.equal(await registration.locator("#new-password").inputValue(), "");

    await registration.locator("#new-password").click();
    await registration.evaluate(() => {
      const rect = document.querySelector("#new-password").getBoundingClientRect();
      const overlay = document.createElement("div");
      Object.assign(overlay.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, background: "black", zIndex: "2147483647" });
      document.body.append(overlay);
    });
    await registration.bringToFront();
    await popup.evaluate(() => document.querySelector("#fillGeneratedPassword").click());
    await expectText(popup, "#status", "Click directly in a visible password field on the page first");
    assert.equal(await registration.locator("#new-password").inputValue(), "");
  });
});

test("document_start snapshot rejects an earlier page capture handler that mutates text to password", { skip: !chromeExecutable() && "Google Chrome executable not found" }, async () => {
  await withLoadedExtension(async ({ context, extensionId, port }) => {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/event-order-race.html`);
    await page.locator("#mutable-target").click();

    assert.equal(await page.locator("#mutable-target").getAttribute("type"), "password", "the earlier page window capture handler performed the exploit mutation");
    assert.deepEqual(await page.evaluate(() => globalThis.__pagePointerOrder), [
      "window:pointerdown:text",
      "document:pointerdown:password",
      "window:pointerup:password",
      "document:pointerup:password"
    ], "inline page handlers demonstrate capture ordering around the mutation");

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.locator("#generatePassword").click();
    await page.bringToFront();
    await popup.evaluate(() => document.querySelector("#fillGeneratedPassword").click());

    await expectText(popup, "#status", "Click directly in a visible password field on the page first");
    assert.equal(await page.locator("#mutable-target").inputValue(), "", "a text input at the extension's earliest pointer snapshot must never be authorized");

    await page.bringToFront();
    await page.locator("#reverted-target").click();
    await popup.evaluate(() => { document.querySelector("#status").textContent = "waiting"; });
    await page.bringToFront();
    await popup.evaluate(() => document.querySelector("#fillGeneratedPassword").click());
    await expectText(popup, "#status", "Click directly in a visible password field on the page first");
    assert.equal(await page.locator("#reverted-target").inputValue(), "", "password to text to password mutation during the gesture invalidates the snapshot");
  });
});

async function withLoadedExtension(callback) {
  assert.ok(existsSync(extensionPath), "Chrome extension build exists");
  const port = 26080 + Math.floor(Math.random() * 1000);
  const web = await serveLoginPage(port);
  const userDataDir = await mkdtemp(join(tmpdir(), "gvault-chrome-headless-extension-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: chromeExecutable(),
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--no-first-run", "--no-default-browser-check"]
  });

  try {
    const browserSession = await context.browser().newBrowserCDPSession();
    const { id: extensionId } = await browserSession.send("Extensions.loadUnpacked", { path: extensionPath });
    assert.ok(extensionId, "Chrome extension id returned by CDP Extensions.loadUnpacked");
    await callback({ context, extensionId, port });
  } finally {
    await context.close();
    await closeServer(web);
  }
}

function chromeExecutable() {
  if (process.env.GV_CHROME_EXECUTABLE) return process.env.GV_CHROME_EXECUTABLE;
  const candidates = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return candidates.find((candidate) => existsSync(candidate));
}

async function serveLoginPage(port) {
  const server = createServer((req, res) => {
    if (req.url === "/login-test.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html><html><body><form><label>Email <input id="email" name="email" type="email" autocomplete="email"></label><label>Password <input id="password" name="password" type="password" autocomplete="current-password"></label><button>Login</button></form></body></html>`);
      return;
    }
    if (req.url === "/registration-test.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html><html><body><form id="registration"><label>Email <input id="email" type="email" value="unchanged@example.test"></label><div><label for="new-password">New password</label><input id="new-password" type="password" autocomplete="new-password"></div><label>Confirm password <input id="confirmation" name="password_confirmation" type="password" autocomplete="new-password"></label><input id="visibility-hidden-password" type="password" autocomplete="new-password" style="visibility:hidden"><input id="inert-password" type="password" autocomplete="new-password" inert><div hidden><input id="hidden-ancestor-password" type="password" autocomplete="new-password"></div><div inert><input id="inert-ancestor-password" type="password" autocomplete="new-password"></div><input id="transparent-password" type="password" autocomplete="new-password" style="opacity:0"><input id="near-transparent-password" type="password" style="opacity:0.001"><div style="opacity:0.8"><div style="opacity:0.6"><input id="translucent-ancestor-password" type="password"></div></div><input id="aria-hidden-password" type="password" aria-hidden="true"><input id="clip-path-password" type="password" style="position:absolute;clip-path:inset(100%)"><div style="overflow:hidden;width:1px;height:1px"><input id="clipped-ancestor-password" type="password"></div><button>Register</button></form><script>globalThis.__submitted=false;document.querySelector('#registration').addEventListener('submit',event=>{event.preventDefault();globalThis.__submitted=true;});</script></body></html>`);
      return;
    }
    if (req.url === "/event-order-race.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html><html><head><script>
        globalThis.__pagePointerOrder = [];
        window.addEventListener('pointerdown', event => {
          globalThis.__pagePointerOrder.push('window:pointerdown:' + event.target.type);
          if (event.target.id === 'mutable-target') event.target.type = 'password';
          if (event.target.id === 'reverted-target') {
            event.target.type = 'text';
            event.target.type = 'password';
          }
        }, true);
        document.addEventListener('pointerdown', event => globalThis.__pagePointerOrder.push('document:pointerdown:' + event.target.type), true);
        document.addEventListener('pointerup', event => globalThis.__pagePointerOrder.push('document:pointerup:' + event.target.type), true);
        window.addEventListener('pointerup', event => globalThis.__pagePointerOrder.push('window:pointerup:' + event.target.type), true);
      </script></head><body><input id="mutable-target" type="text" style="width:240px;height:40px"><input id="reverted-target" type="password" style="width:240px;height:40px"></body></html>`);
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
