import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".");
const workflowPath = resolve(root, ".github/workflows/ci.yml");
const artifactCheckPath = resolve(root, "scripts/ci/check-build-artifacts.mjs");
const ciDocPath = resolve(root, "docs/deployment/continuous-integration.md");

test("mandatory CI defines isolated quality and platform gates", async () => {
  assert.ok(existsSync(workflowPath), ".github/workflows/ci.yml must exist");
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /pull_request:/, "pull requests run CI");
  assert.match(workflow, /push:\s*\n\s*branches:\s*\[main\]/, "main pushes run CI");

  const jobs = [
    ["quality", "Quality / full gate"],
    ["chrome", "Chrome extension"],
    ["edge", "Edge extension"],
    ["firefox", "Firefox extension"],
    ["android", "Android APK"]
  ];
  const jobBlocks = new Map();
  for (const [jobId, checkName] of jobs) {
    const block = extractJobBlock(workflow, jobId);
    jobBlocks.set(jobId, block);
    assert.match(block, new RegExp(`name: ${checkName.replace("/", "\\/")}`), `${checkName} is a stable required-check name`);
    assert.match(block, /run: npm ci/, `${jobId} installs from the lockfile`);
  }

  const quality = jobBlocks.get("quality");
  for (const command of ["npm run build", "npm run lint", "npm test", "npm run smoke:server", "npm audit --audit-level=high"]) {
    assert.match(quality, new RegExp(`run: ${command.replaceAll(" ", "\\s+")}`), `quality gate runs ${command}`);
  }
  assert.match(quality, /npx playwright install --with-deps chromium/, "quality installs the lockfile-matched Playwright Chromium");
  assert.match(quality, /GV_CHROME_EXECUTABLE/, "quality routes shared Chrome tests to the installed Playwright runtime");
  assert.match(quality, /GV_CHROME_PATH/, "quality routes QR/TOTP Chrome tests to the installed Playwright runtime");
  assert.match(quality, /node scripts\/ci\/check-build-artifacts\.mjs\s*$/m, "quality validates the full build");

  const chrome = jobBlocks.get("chrome");
  assert.match(chrome, /xvfb-run[^\n]*npm run smoke:chrome-extension/, "Chrome runs in an isolated virtual display");
  assert.match(chrome, /check-build-artifacts\.mjs --target chrome/, "Chrome validates its artifact");

  const edge = jobBlocks.get("edge");
  assert.match(edge, /npm run smoke:edge-extension/, "Edge runtime smoke runs");
  assert.match(edge, /check-build-artifacts\.mjs --target edge/, "Edge validates its artifact");

  const firefox = jobBlocks.get("firefox");
  assert.match(firefox, /npm run smoke:firefox-extension/, "Firefox runtime smoke runs");
  assert.match(firefox, /check-build-artifacts\.mjs --target firefox/, "Firefox validates its artifact");

  const android = jobBlocks.get("android");
  assert.match(android, /npm run build:android/, "Android APK build runs");
  assert.match(android, /check-build-artifacts\.mjs --target android/, "Android validates its artifact");
  assert.match(android, /actions\/upload-artifact@[0-9a-f]{40}/, "Android APK is retained as a CI artifact");

  for (const action of workflow.matchAll(/^\s+-?\s*uses:\s*[^@\s]+@([^\s]+)(?:\s+#\s+v\d[^\s]*)?$/gm)) {
    assert.match(action[1], /^[0-9a-f]{40}$/, `${action[0].trim()} uses an immutable action revision`);
  }
});

test("artifact checker and CI operating contract are versioned", async () => {
  assert.ok(existsSync(artifactCheckPath), "artifact checker must exist");
  assert.ok(existsSync(ciDocPath), "CI operating documentation must exist");

  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  assert.match(packageJson.scripts.test, /--test-concurrency=1/, "the full test gate is serialized");

  const documentation = await readFile(ciDocPath, "utf8");
  for (const checkName of ["Quality / full gate", "Chrome extension", "Edge extension", "Firefox extension", "Android APK"]) {
    assert.match(documentation, new RegExp(checkName.replace("/", "\\/")), `${checkName} is documented as a required check`);
  }
  assert.match(documentation, /physical Android device/i, "physical-device acceptance remains explicit");
});

function extractJobBlock(workflow, jobId) {
  const header = `  ${jobId}:\n`;
  const start = workflow.indexOf(header);
  assert.notEqual(start, -1, `${jobId} job exists`);
  const tail = workflow.slice(start + header.length);
  const nextJob = tail.search(/^  [a-zA-Z0-9_-]+:\n/m);
  return header + (nextJob === -1 ? tail : tail.slice(0, nextJob));
}
