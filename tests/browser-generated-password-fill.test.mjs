import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const contentScript = await readFile("apps/browser-extension/src/content-script.js", "utf8");

async function withPage(html, callback) {
  const browser = await chromium.launch(chromeLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(html);
    await page.evaluate(() => {
      globalThis.chrome = {
        runtime: {
          onMessage: { addListener(listener) { globalThis.__gvaultListener = listener; } },
          sendMessage() {}
        }
      };
    });
    await page.addScriptTag({ content: contentScript });
    await callback(page);
  } finally {
    await browser.close();
  }
}

async function sendContentMessage(page, message) {
  return page.evaluate((payload) => Promise.race([
    new Promise((resolve) => globalThis.__gvaultListener(payload, {}, resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error("content script did not handle generated-password fill")), 500))
  ]), message);
}

test("generated-password fill writes exactly the password field authorized by a trusted click", async () => {
  await withPage(`<!doctype html><form id="registration">
    <input id="email" type="email" value="person@example.test">
    <input id="password" type="password" autocomplete="new-password">
    <input id="confirmation" type="password" autocomplete="new-password">
    <button>Register</button>
  </form>`, async (page) => {
    await page.evaluate(() => {
      globalThis.__events = [];
      globalThis.__submitted = false;
      for (const id of ["password", "confirmation"]) {
        for (const type of ["input", "change"]) document.querySelector(`#${id}`).addEventListener(type, () => globalThis.__events.push(`${id}:${type}`));
      }
      document.querySelector("#registration").addEventListener("submit", (event) => { event.preventDefault(); globalThis.__submitted = true; });
    });
    await page.locator("#password").click();

    const response = await sendContentMessage(page, { type: "GV_FILL_GENERATED_PASSWORD", password: "generated-value" });

    assert.deepEqual(response, { filled: 1 });
    assert.equal(await page.locator("#password").inputValue(), "generated-value");
    assert.equal(await page.locator("#confirmation").inputValue(), "");
    assert.equal(await page.locator("#email").inputValue(), "person@example.test");
    assert.deepEqual(await page.evaluate(() => globalThis.__events), ["password:input", "password:change"]);
    assert.equal(await page.evaluate(() => globalThis.__submitted), false);
  });
});

test("clicking a label does not authorize its password input through forwarded activation", async () => {
  await withPage('<form><label for="password">Password</label><input id="password" type="password"></form>', async (page) => {
    await page.locator("label").click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "password", "Chrome forwards trusted label activation and focuses the input");
    const response = await sendContentMessage(page, { type: "GV_FILL_GENERATED_PASSWORD", password: "must-not-fill" });
    assert.deepEqual(response, { filled: 0 });
    assert.equal(await page.locator("#password").inputValue(), "");
  });
});

test("synthetic pointer gestures do not authorize a generated-password target", async () => {
  await withPage('<form><input id="password" type="password"></form>', async (page) => {
    await page.evaluate(() => {
      const input = document.querySelector("#password");
      input.focus();
      input.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      input.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });
    const response = await sendContentMessage(page, { type: "GV_FILL_GENERATED_PASSWORD", password: "must-not-fill" });
    assert.deepEqual(response, { filled: 0 });
    assert.equal(await page.locator("#password").inputValue(), "");
  });
});

test("an opaque overlay added after authorization blocks generated-password fill", async () => {
  await withPage('<form><input id="password" type="password" style="width:240px;height:40px"></form>', async (page) => {
    await page.locator("#password").click();
    await page.evaluate(() => {
      const rect = document.querySelector("#password").getBoundingClientRect();
      const overlay = document.createElement("div");
      Object.assign(overlay.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, background: "black", zIndex: "2147483647" });
      document.body.append(overlay);
    });
    const response = await sendContentMessage(page, { type: "GV_FILL_GENERATED_PASSWORD", password: "must-not-fill" });
    assert.deepEqual(response, { filled: 0 });
    assert.equal(await page.locator("#password").inputValue(), "");
  });
});

test("trusted clicks do not authorize targets below the conservative effective-opacity threshold", async () => {
  for (const fixture of [
    '<input id="password" type="password" style="opacity:0.001;width:240px;height:40px">',
    '<div style="opacity:0.8"><div style="opacity:0.6"><input id="password" type="password" style="width:240px;height:40px"></div></div>'
  ]) {
    await withPage(`<form>${fixture}</form>`, async (page) => {
      await page.locator("#password").click({ force: true });
      const response = await sendContentMessage(page, { type: "GV_FILL_GENERATED_PASSWORD", password: "must-not-fill" });
      assert.deepEqual(response, { filled: 0 });
      assert.equal(await page.locator("#password").inputValue(), "");
    });
  }
});

test("a normally visible password target remains eligible for generated-password fill", async () => {
  await withPage('<form><div style="opacity:0.9"><input id="password" type="password" style="opacity:0.9;width:240px;height:40px"></div></form>', async (page) => {
    await page.locator("#password").click();
    const response = await sendContentMessage(page, { type: "GV_FILL_GENERATED_PASSWORD", password: "generated-value" });
    assert.deepEqual(response, { filled: 1 });
    assert.equal(await page.locator("#password").inputValue(), "generated-value");
  });
});

test("generated-password fill writes zero when no password field was authorized by a trusted click", async () => {
  await withPage(`<!doctype html><form>
    <input id="visible" type="password" autocomplete="new-password">
    <input id="clipped" type="password" style="position:absolute;clip-path:inset(100%)">
    <div style="overflow:hidden;width:1px;height:1px"><input id="clipped-ancestor" type="password"></div>
    <input id="near-transparent" type="password" style="opacity:0.001">
    <input id="aria-hidden" type="password" aria-hidden="true">
  </form>`, async (page) => {
    const response = await sendContentMessage(page, { type: "GV_FILL_GENERATED_PASSWORD", password: "must-not-be-used" });
    assert.deepEqual(response, { filled: 0 });
    for (const id of ["visible", "clipped", "clipped-ancestor", "near-transparent", "aria-hidden"]) {
      assert.equal(await page.locator(`#${id}`).inputValue(), "");
    }
  });
});

test("synthetic focusin and programmatic focus never authorize a generated-password target", async () => {
  for (const attack of ["synthetic-focusin", "programmatic-focus"]) {
    await withPage('<form><input id="honest" type="password"><input id="trap" type="password"></form>', async (page) => {
      await page.evaluate((kind) => {
        const trap = document.querySelector("#trap");
        if (kind === "synthetic-focusin") trap.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        if (kind === "programmatic-focus") trap.focus();
      }, attack);

      const response = await sendContentMessage(page, { type: "GV_FILL_GENERATED_PASSWORD", password: "must-not-fill" });

      assert.deepEqual(response, { filled: 0 }, attack);
      assert.equal(await page.locator("#trap").inputValue(), "", attack);
      assert.equal(await page.locator("#honest").inputValue(), "", attack);
    });
  }
});

test("clicking a non-password field invalidates the explicit password target", async () => {
  await withPage('<form><input id="password" type="password"><input id="email" type="email"></form>', async (page) => {
    await page.locator("#password").click();
    await page.locator("#email").click();
    const response = await sendContentMessage(page, { type: "GV_FILL_GENERATED_PASSWORD", password: "unused" });
    assert.deepEqual(response, { filled: 0 });
    assert.equal(await page.locator("#password").inputValue(), "");
  });
});

test("trusted target revalidation rejects hidden, low-opacity, inert, disabled, readonly, removed, or disconnected targets", async () => {
  for (const mutation of ["hidden", "display-none", "visibility-hidden", "opacity-low", "ancestor-opacity-low", "ancestor-display-none", "ancestor-visibility-hidden", "inert", "disabled", "readonly", "removed"]) {
    await withPage('<form><div id="root"><input id="focused" type="password"></div><input id="other" type="password"></form>', async (page) => {
      await page.locator("#focused").click();
      await page.evaluate((kind) => {
        const input = document.querySelector("#focused");
        if (kind === "hidden") input.hidden = true;
        if (kind === "display-none") input.style.display = "none";
        if (kind === "visibility-hidden") input.style.visibility = "hidden";
        if (kind === "opacity-low") input.style.opacity = "0.001";
        if (kind === "ancestor-opacity-low") document.querySelector("#root").style.opacity = "0.49";
        if (kind === "ancestor-display-none") document.querySelector("#root").style.display = "none";
        if (kind === "ancestor-visibility-hidden") document.querySelector("#root").style.visibility = "hidden";
        if (kind === "inert") document.querySelector("#root").inert = true;
        if (kind === "disabled") input.disabled = true;
        if (kind === "readonly") input.readOnly = true;
        if (kind === "removed") input.remove();
      }, mutation);
      const response = await sendContentMessage(page, { type: "GV_FILL_GENERATED_PASSWORD", password: "unused" });
      assert.deepEqual(response, { filled: 0 }, mutation);
      assert.equal(await page.locator("#other").inputValue(), "", mutation);
      if (mutation !== "removed") assert.equal(await page.locator("#focused").inputValue(), "", mutation);
    });
  }
});

function chromeLaunchOptions() {
  const executablePath = process.env.GV_CHROME_EXECUTABLE || ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
  return executablePath ? { executablePath } : {};
}
