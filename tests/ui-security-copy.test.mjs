import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const webShell = await readFile(new URL("../apps/web/public/index.html", import.meta.url), "utf8");

const misleadingInitialSecurityClaims = [
  "All good",
  "All changes are synced.",
  "Last backup:",
  "Backed up",
  "Connected</strong>"
];

test("web shell avoids hardcoded security/sync/backup success claims before live verification", () => {
  for (const claim of misleadingInitialSecurityClaims) {
    assert.equal(webShell.includes(claim), false, `unexpected hardcoded claim: ${claim}`);
  }
});

test("web shell uses neutral status copy for unverified server, sync, and backup state", () => {
  assert.match(webShell, /<strong class="connected">Self-hosted<\/strong>/);
  assert.match(webShell, /<strong>Status<\/strong><span>Use the health check or sign in before trusting server status\.<\/span>/);
  assert.match(webShell, /<strong>Sync<\/strong><span>Sync runs after sign-in and unlock; this screen does not imply pending changes are uploaded\.<\/span>/);
  assert.match(webShell, /<strong>Backup<\/strong><span>Use authenticated export\/import proof before treating backup state as complete\.<\/span>/);
});
