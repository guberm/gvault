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

const qrFile = {
  name: "authenticator-qr.png",
  mimeType: "image/png",
  buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
};

test("supported browsers scan a standard TOTP QR into a draft without saving or leaking it", async () => {
  const server = await startStaticServer();
  let browser;
  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript((secret) => {
      window.__qrPayload = `otpauth://totp/Example%20Co:alice%40example.com?secret=${secret}&issuer=Example%20Co&algorithm=SHA1&digits=6&period=30`;
      window.__detectedImages = 0;
      class TestBarcodeDetector {
        static async getSupportedFormats() { return ["qr_code"]; }
        constructor(options) { window.__detectorFormats = options.formats; }
        async detect(image) {
          window.__detectedImages += image === window.__imageBitmap ? 1 : 100;
          return [{ rawValue: window.__qrPayload }];
        }
      }
      window.BarcodeDetector = TestBarcodeDetector;
      window.__imageBitmap = { close() { window.__imageClosed = true; } };
      window.createImageBitmap = async () => window.__imageBitmap;
    }, rfcSecret);

    const requests = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url());
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await unlock(page);
    await page.getByLabel("Item type").selectOption("authenticator");

    const scanInput = page.getByLabel("Scan authenticator QR code");
    await scanInput.waitFor({ state: "attached" });
    assert.equal(await scanInput.getAttribute("accept"), "image/*");
    assert.equal(await scanInput.getAttribute("capture"), "environment");
    await scanInput.setInputFiles(qrFile);

    await assertValue(page.getByLabel("TOTP secret"), rfcSecret);
    await assertValue(page.getByLabel("Name *"), "Example Co:alice@example.com");
    assert.deepEqual(await page.evaluate(() => window.__detectorFormats), ["qr_code"]);
    assert.equal(await page.evaluate(() => window.__detectedImages), 1, "the selected image is decoded once");
    assert.equal(await page.evaluate(() => window.__imageClosed), true, "temporary image resources are released");
    assert.equal(await page.locator(".item-row").count(), 0, "scanning does not save locally");
    assert.deepEqual(requests, [], "scanning performs no API request");
    await assertText(page.locator("#status"), "Authenticator QR code added to the editor. Review it and save changes.");
    const status = await page.locator("#status").textContent();
    assert.equal(status.includes(rfcSecret), false, "status does not reveal the secret");
    assert.equal(status.includes("otpauth://"), false, "status does not reveal the QR payload");

    await page.getByRole("button", { name: "Save changes" }).click();
    assert.equal(await page.locator(".item-row").count(), 1, "explicit Save persists the scanned draft");
    await assertText(page.locator(".item-row"), "Example Co:alice@example.com");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("QR enrollment rejects non-TOTP and unsupported parameters without changing the draft or leaking payloads", async () => {
  const server = await startStaticServer();
  let browser;
  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript((secret) => {
      window.__qrPayload = "";
      class TestBarcodeDetector {
        static async getSupportedFormats() { return ["qr_code"]; }
        async detect() { return [{ rawValue: window.__qrPayload }]; }
      }
      window.BarcodeDetector = TestBarcodeDetector;
      window.createImageBitmap = async () => ({ close() {} });
      window.__secretForQrTest = secret;
    }, rfcSecret);
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await unlock(page);
    await page.getByLabel("Item type").selectOption("authenticator");
    const scanInput = page.getByLabel("Scan authenticator QR code");
    await scanInput.waitFor({ state: "attached" });
    await page.getByLabel("Name *").fill("Keep this title");
    await page.getByLabel("TOTP secret").fill("KEEPTHISSECRET");

    const rejected = [
      [`otpauth://hotp/Example?secret=${rfcSecret}`, "Only TOTP authenticator QR codes are supported."],
      [`otpauth://totp/Example?secret=${rfcSecret}&algorithm=SHA256`, "This authenticator QR code uses unsupported settings."],
      [`https://example.com/not-an-authenticator?secret=${rfcSecret}`, "The selected image does not contain a valid authenticator QR code."],
      ["otpauth://totp/Example?secret=INVALID!", "The selected image does not contain a valid authenticator QR code."],
    ];
    for (const [payload, expectedStatus] of rejected) {
      await page.evaluate((value) => { window.__qrPayload = value; }, payload);
      await scanInput.setInputFiles(qrFile);
      await assertText(page.locator("#status"), expectedStatus);
      await assertValue(page.getByLabel("Name *"), "Keep this title");
      await assertValue(page.getByLabel("TOTP secret"), "KEEPTHISSECRET");
      const status = await page.locator("#status").textContent();
      assert.equal(status.includes(rfcSecret), false, "rejection status does not reveal the scanned secret");
      assert.equal(status.includes(payload), false, "rejection status does not reveal the QR payload");
    }
    assert.equal(await page.locator(".item-row").count(), 0, "rejected scans do not save a draft");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("a scan completed after leaving the Authenticator editor cannot overwrite the new draft", async () => {
  const server = await startStaticServer();
  let browser;
  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript((secret) => {
      window.__qrPayload = `otpauth://totp/Stale%20Authenticator?secret=${secret}`;
      class DelayedBarcodeDetector {
        static async getSupportedFormats() { return ["qr_code"]; }
        async detect() {
          return new Promise((resolve) => { window.__resolveDetection = () => resolve([{ rawValue: window.__qrPayload }]); });
        }
      }
      window.BarcodeDetector = DelayedBarcodeDetector;
      window.createImageBitmap = async () => ({ close() { window.__staleImageClosed = true; } });
    }, rfcSecret);
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await unlock(page);
    await page.getByLabel("Item type").selectOption("authenticator");
    const scanInput = page.getByLabel("Scan authenticator QR code");
    await scanInput.waitFor({ state: "attached" });
    await scanInput.setInputFiles(qrFile);
    await page.waitForFunction(() => typeof window.__resolveDetection === "function");

    await page.getByLabel("Item type").selectOption("login");
    await page.getByLabel("Name *").fill("Keep login draft");
    await page.evaluate(() => { window.__resolveDetection(); });
    await page.waitForFunction(() => window.__staleImageClosed === true);

    await assertValue(page.getByLabel("Name *"), "Keep login draft");
    await assertValue(page.getByLabel("Item type"), "login");
    assert.equal(await page.locator(".item-row").count(), 0);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("late QR capability detection adds the control without clearing an in-progress authenticator draft", async () => {
  const server = await startStaticServer();
  let browser;
  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      class DelayedBarcodeDetector {
        static getSupportedFormats() {
          return new Promise((resolve) => { window.__resolveBarcodeFormats = resolve; });
        }
      }
      window.BarcodeDetector = DelayedBarcodeDetector;
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await unlock(page);
    await page.getByLabel("Item type").selectOption("authenticator");
    await page.getByLabel("Name *").fill("Draft authenticator");
    await page.getByLabel("TOTP secret").fill(rfcSecret);

    await page.evaluate(() => { window.__resolveBarcodeFormats(["qr_code"]); });
    await page.getByLabel("Scan authenticator QR code").waitFor({ state: "attached" });
    await assertValue(page.getByLabel("Name *"), "Draft authenticator");
    await assertValue(page.getByLabel("TOTP secret"), rfcSecret);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("the newest QR selection wins when scans finish out of order", async () => {
  const server = await startStaticServer();
  let browser;
  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      window.__pendingQrDetections = [];
      class TestBarcodeDetector {
        static async getSupportedFormats() { return ["qr_code"]; }
        async detect(image) {
          return new Promise((resolve) => window.__pendingQrDetections.push({ imageName: image.name, resolve }));
        }
      }
      window.BarcodeDetector = TestBarcodeDetector;
      window.createImageBitmap = async (file) => ({ name: file.name, close() {} });
    });

    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await unlock(page);
    await page.getByLabel("Item type").selectOption("authenticator");
    const scanInput = page.getByLabel("Scan authenticator QR code");
    await scanInput.waitFor({ state: "attached" });

    await scanInput.setInputFiles({ ...qrFile, name: "older.png" });
    await page.waitForFunction(() => window.__pendingQrDetections.length === 1);
    await scanInput.setInputFiles({ ...qrFile, name: "newer.png" });
    await page.waitForFunction(() => window.__pendingQrDetections.length === 2);

    await page.evaluate((secret) => {
      window.__pendingQrDetections[1].resolve([{ rawValue: `otpauth://totp/Newer?secret=${secret}&issuer=Example` }]);
    }, rfcSecret);
    await assertValue(page.getByLabel("Name *"), "Newer");

    await page.evaluate((secret) => {
      window.__pendingQrDetections[0].resolve([{ rawValue: `otpauth://totp/Older?secret=${secret}&issuer=Example` }]);
    }, rfcSecret);
    await assertValue(page.getByLabel("Name *"), "Newer");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unsupported browsers keep manual TOTP entry without a misleading QR control", async () => {
  const server = await startStaticServer();
  let browser;
  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      class UnsupportedBarcodeDetector {
        static async getSupportedFormats() { return ["aztec", "data_matrix"]; }
      }
      window.BarcodeDetector = UnsupportedBarcodeDetector;
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await unlock(page);
    await page.getByLabel("Item type").selectOption("authenticator");
    await page.waitForTimeout(50);

    assert.equal(await page.getByLabel("Scan authenticator QR code").count(), 0);
    const secretInput = page.getByLabel("TOTP secret");
    assert.equal(await secretInput.getAttribute("type"), "password");
    await secretInput.fill(rfcSecret);
    await assertValue(secretInput, rfcSecret);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

async function unlock(page) {
  await page.getByLabel("Master password", { exact: true }).fill("local-master-password");
  await page.getByRole("button", { name: "Unlock vault" }).click();
}

async function assertValue(locator, expected) {
  await locator.waitFor({ state: "attached" });
  assert.equal(await locator.inputValue(), expected);
}

async function assertText(locator, expected, timeout = 2_000) {
  const deadline = performance.now() + timeout;
  while (performance.now() <= deadline) {
    if ((await locator.textContent().catch(() => ""))?.includes(expected)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`Expected text ${JSON.stringify(expected)}; received ${JSON.stringify(await locator.textContent().catch(() => null))}`);
}

function chromeLaunchOptions() {
  const executablePath = process.env.GV_CHROME_PATH;
  return executablePath ? { executablePath, headless: true } : { headless: true };
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const file = join(root, relative);
    if (!existsSync(file) || !file.startsWith(root)) {
      response.writeHead(404).end("not found");
      return;
    }
    response.writeHead(200, { "content-type": contentTypes.get(extname(file)) || "application/octet-stream" });
    response.end(await readFile(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}
