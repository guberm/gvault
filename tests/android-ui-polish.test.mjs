import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Android auth-first UI uses density-safe spacing, visible labels, and current device acceptance copy", async () => {
  const main = await readFile("apps/mobile/android/src/main/java/com/gvault/app/MainActivity.java", "utf8");
  const theme = await readFile("apps/mobile/android/res/values/styles.xml", "utf8");
  const deviceE2e = await readFile("scripts/dev/android-device-e2e.ps1", "utf8");

  assert.match(main, /root\.setPadding\(dp\(20\), dp\(24\), dp\(20\), dp\(24\)\)/, "screen gutters are density independent");
  assert.match(main, /addLabeledField\(authCard, "Server URL", server\)/);
  assert.match(main, /addLabeledField\(authCard, "Confirm master password", confirmMaster\)/);
  assert.match(main, /addLabeledField\(editorCard, "Login title", editTitle\)/, "vault editor fields keep labels after auth");
  assert.match(main, /editorCard\.setBackground\(rounded\(MobileUiStyle\.SURFACE/, "vault editor is grouped as a coherent surface");
  assert.match(main, /field\.setMinHeight\(dp\(48\)\)/, "editable controls meet the mobile touch-height baseline");
  assert.match(main, /params\.setMargins\(0, dp\(12\), 0, 0\)/, "vertical rhythm is density independent");
  assert.doesNotMatch(main, /setPadding\(0, (?:12|18), 0,/, "screen sections do not mix raw pixels into dp-based spacing");
  assert.doesNotMatch(main, /field\("Confirm master password \(create account\)"/, "long registration guidance is not clipped inside a hint");
  assert.match(main, /scroll\.setFillViewport\(true\)/, "short auth content can be composed across the full viewport");
  assert.match(main, /WindowInsets\.Type\.systemBars\(\)/, "scrolling content stays outside Android system bars");
  assert.match(main, /scroll\.setClipToPadding\(true\)/, "system-bar padding clips scrolled content to the safe viewport");
  assert.match(theme, /<item name="android:colorAccent">#0F766E<\/item>/, "native controls use the GVault teal accent");
  assert.match(theme, /<item name="android:windowLightStatusBar">true<\/item>/, "light edge-to-edge status bar keeps dark system icons legible");
  assert.match(theme, /<item name="android:statusBarColor">#F4F7F9<\/item>/, "older Android versions receive the same light status-bar surface");

  assert.match(deviceE2e, /Sign in or create an account to use your server-backed encrypted vault/);
  assert.match(deviceE2e, /https:\/\/gvault\.guber\.dev/);
  assert.match(deviceE2e, /Confirm master password/);
  assert.doesNotMatch(deviceE2e, /Self-hosted password and identity vault|Open Web Vault/, "device smoke does not assert legacy placeholder copy");
});
