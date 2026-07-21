import { spawnSync } from "node:child_process";
import { stat, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  combineSignerEvidence,
  extractSignerSha256,
  normalizeSignerEvidence,
} from "./android-signer-evidence.mjs";

const root = resolve(".");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const targetIndex = process.argv.indexOf("--target");
const target = targetIndex === -1 ? "full" : process.argv[targetIndex + 1];
const knownTargets = new Set(["full", "chrome", "edge", "firefox", "android"]);
const previewSignerSha256 = "e73b8d51308aaf53d92ab9075838fb7de5438d436c89227cb147b94f4655d6f4";

if (!knownTargets.has(target)) {
  throw new Error(`Unknown artifact target: ${String(target)}`);
}

if (target === "full") await checkFullBuild();
if (["chrome", "edge", "firefox"].includes(target)) await checkBrowserExtension(target);
if (target === "android") await checkAndroid();

console.log(`GVault ${target} artifacts ok for v${packageJson.version}`);

async function checkFullBuild() {
  const files = [
    "apps/admin/dist/index.html",
    "apps/mobile/dist/mobile-architecture.json",
    "apps/web/dist/index.html",
    "apps/web/dist/app.js",
    "apps/web/dist/styles.css",
    "apps/web/dist/totp.js",
    "apps/desktop/dist/index.js",
    "apps/server/dist/index.js",
    "apps/server/dist/auth.js",
    "apps/server/dist/storage.js",
    "packages/api-client/dist/index.js",
    "packages/core/dist/index.js",
    "packages/crypto/dist/index.js",
    "packages/shared-utils/dist/index.js",
    "packages/sync/dist/index.js",
    "packages/ui/dist/index.js",
    "packages/vault-models/dist/index.js"
  ];

  await Promise.all(files.map((file) => requireNonEmpty(file)));
  await Promise.all(["chrome", "edge", "firefox"].map((browser) => checkBrowserExtension(browser)));

  const webIndex = await readFile(resolve(root, "apps/web/dist/index.html"), "utf8");
  if (!webIndex.includes(`v${packageJson.version}`)) {
    throw new Error(`apps/web/dist/index.html does not identify v${packageJson.version}`);
  }
}

async function checkBrowserExtension(browser) {
  const directory = `apps/browser-extension/dist/${browser}`;
  for (const file of ["manifest.json", "service-worker.js", "content-script.js", "popup.html", "popup.js", "options.html", "options.js"]) {
    await requireNonEmpty(`${directory}/${file}`);
  }

  const manifest = JSON.parse(await readFile(resolve(root, directory, "manifest.json"), "utf8"));
  const expectedName = browser === "chrome" ? "GVault" : `GVault for ${titleCase(browser)}`;
  if (manifest.manifest_version !== 3) throw new Error(`${browser} manifest is not MV3`);
  if (manifest.version !== packageJson.version) throw new Error(`${browser} manifest version is ${manifest.version}, expected ${packageJson.version}`);
  if (manifest.name !== expectedName) throw new Error(`${browser} manifest name is ${manifest.name}, expected ${expectedName}`);
  if (browser === "firefox" && !manifest.browser_specific_settings?.gecko?.id) {
    throw new Error("Firefox manifest has no stable Gecko id");
  }
}

async function checkAndroid() {
  const base = `apps/mobile/dist/gvault-android-v${packageJson.version}`;
  const apkPath = resolve(root, `${base}.apk`);
  const apk = await requireNonEmpty(`${base}.apk`);
  if (apk.size < 10_000) throw new Error(`${base}.apk is unexpectedly small (${apk.size} bytes)`);

  const apksigner = await findApkSigner();
  const result = spawnSync(apksigner, ["verify", "--print-certs", apkPath], {
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `apksigner exited with ${result.status}`);

  const actualEvidence = combineSignerEvidence(result);
  const recordedEvidence = normalizeSignerEvidence(await readFile(resolve(root, `${base}.verify.txt`), "utf8"));
  if (actualEvidence !== recordedEvidence) throw new Error(`${base}.verify.txt does not match the APK signer evidence`);

  const fingerprint = extractSignerSha256(actualEvidence);
  if (fingerprint !== previewSignerSha256) {
    throw new Error(`${base}.apk signer is ${String(fingerprint)}, expected trusted preview signer ${previewSignerSha256}`);
  }
}

async function findApkSigner() {
  const sdk = process.env.ANDROID_HOME
    || process.env.ANDROID_SDK_ROOT
    || (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Android", "Sdk") : "");
  if (!sdk) throw new Error("Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT.");

  const buildToolsRoot = join(sdk, "build-tools");
  const versions = (await readdir(buildToolsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
  if (!versions.length) throw new Error(`Android build-tools not found in ${buildToolsRoot}`);

  const apksigner = join(buildToolsRoot, versions[0], process.platform === "win32" ? "apksigner.bat" : "apksigner");
  await requireAbsoluteFile(apksigner);
  return apksigner;
}

async function requireNonEmpty(relativePath) {
  const file = await stat(resolve(root, relativePath)).catch(() => null);
  if (!file?.isFile() || file.size === 0) throw new Error(`Missing or empty artifact: ${relativePath}`);
  return file;
}

async function requireAbsoluteFile(filePath) {
  const file = await stat(filePath).catch(() => null);
  if (!file?.isFile()) throw new Error(`Missing file: ${filePath}`);
}

function titleCase(value) {
  return value[0].toUpperCase() + value.slice(1);
}
