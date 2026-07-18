import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const popupHtml = await readFile("apps/browser-extension/src/popup.html", "utf8");
const popupScript = await readFile("apps/browser-extension/src/popup.js", "utf8");
const android = await readFile("apps/mobile/android/src/main/java/com/gvault/app/MainActivity.java", "utf8");
const androidManifest = await readFile("apps/mobile/android/AndroidManifest.xml", "utf8");
const windows = await readFile("apps/desktop/windows/Program.cs", "utf8");

test("browser popup settings is an isolated destination and close restores content", async () => {
  const executablePath = process.env.GV_CHROME_EXECUTABLE
    || process.env.GV_CHROME_PATH
    || ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
  const browser = await chromium.launch(executablePath ? { headless: true, executablePath } : { headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    await page.evaluate(() => {
      globalThis.chrome = {
        runtime: { sendMessage: async () => ({ ok: true }), openOptionsPage() {} },
        tabs: { query: async () => [{ url: "https://example.test/login" }], create: async () => ({ id: 1 }) },
        storage: {
          onChanged: { addListener() {} },
          sync: { get: async () => ({}), set: async () => undefined },
          session: { get: async () => ({}), remove: async () => undefined }
        }
      };
    });
    await page.addScriptTag({ content: popupScript });

    assert.equal(await page.locator("#contentSurface").isVisible(), true);
    assert.equal(await page.locator("#settingsSurface").isVisible(), false);

    await page.locator("#showSettings").click();
    assert.equal(await page.locator("#contentSurface").isVisible(), false, "opening settings hides popup content");
    assert.equal(await page.locator("#settingsSurface").isVisible(), true, "opening settings shows only settings");

    await page.locator("#closeSettings").click();
    assert.equal(await page.locator("#contentSurface").isVisible(), true, "closing settings restores popup content");
    assert.equal(await page.locator("#settingsSurface").isVisible(), false);
  } finally {
    await browser.close();
  }
});

test("Android settings uses a separate root and native back restores the vault", () => {
  assert.match(android, /private void showSettingsScreen\(\)/);
  assert.match(android, /if \(settingsVisible\) \{\s*showVaultScreen\("Settings closed\."\);\s*renderFilteredVaultList\(searchVault == null \? "" : searchVault\.getText\(\)\.toString\(\)\);\s*return;\s*\}/s,
    "native Back restores the vault shell and immediately repopulates its item surface");
  assert.match(android, /public void onBackPressed\(\)/);
  assert.match(androidManifest, /android:enableOnBackInvokedCallback="false"/,
    "Android 13+ dispatches system Back through the activity override used for settings restoration");
  assert.match(android, /private void showAccountScreen\(\) \{\s*settingsVisible = false;/s, "auth transitions clear settings state");
});

test("Windows settings hides the content surface and back restores it", () => {
  assert.match(windows, /void ShowSettings\(\)/);
  assert.match(windows, /contentSurface\.Visible = false;/);
  assert.match(windows, /settingsSurface\.Visible = true;/);
  assert.match(windows, /void ShowContent\(\)/);
  assert.match(windows, /backToContent\.Click \+= \(_, _\) => ShowContent\(\);/);
});
