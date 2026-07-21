import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { createServer as createHttpServer, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("public web/API wrapper returns malformed-body errors without exiting", async () => {
  const server = await startPublicServer();

  try {
    const malformed = await rawRequest(server.base, "/api/auth/login", "{not-json", {
      "content-length": 9,
      "content-type": "application/json",
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(malformed.body, { error: "Malformed JSON" });

    const health = await rawRequest(server.base, "/healthz", undefined, {});
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);
    assert.equal(server.child.exitCode, null);
  } finally {
    await server.stop();
  }
});

test("public web/API wrapper returns oversized-body errors without exiting", async () => {
  const server = await startPublicServer({ GV_JSON_BODY_LIMIT_BYTES: "64" });
  const body = JSON.stringify({ padding: "x".repeat(128) });

  try {
    const oversized = await rawRequest(server.base, "/api/auth/login", body, {
      "content-length": Buffer.byteLength(body),
      "content-type": "application/json",
    });
    assert.equal(oversized.status, 413);
    assert.deepEqual(oversized.body, { error: "Request body too large" });

    const health = await rawRequest(server.base, "/healthz", undefined, {});
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);
    assert.equal(server.child.exitCode, null);
  } finally {
    await server.stop();
  }
});

test("public web/API wrapper sets restrictive browser security headers", async () => {
  const server = await startPublicServer();
  const expected = {
    "content-security-policy": "default-src 'self'; base-uri 'none'; connect-src 'self' https:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self'; style-src 'self'",
    "strict-transport-security": "max-age=31536000",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "permissions-policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), clipboard-read=(), clipboard-write=(self)",
  };

  try {
    for (const [path, status] of [["/", 200], ["/app.js", 200], ["/styles.css", 200], ["/healthz", 200], ["/api/auth/sessions", 401]]) {
      const response = await rawRequest(server.base, path, undefined, {});
      assert.equal(response.status, status, path);
      for (const [header, value] of Object.entries(expected)) assert.equal(response.headers[header], value, `${path} ${header}`);
    }
  } finally {
    await server.stop();
  }
});

async function startPublicServer(environment = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), "gvault-public-abuse-controls-"));
  const port = await reservePort();
  const child = spawn(process.execPath, ["scripts/dev/serve-public.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      GV_DATA_DIR: dataDir,
      GV_PUBLIC_HOST: "127.0.0.1",
      GV_PUBLIC_PORT: String(port),
      ...environment,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  await waitForServer(port, child, () => output);
  return {
    base: `http://127.0.0.1:${port}`,
    child,
    stop: async () => {
      if (child.exitCode === null) {
        child.kill();
        await new Promise((resolve) => child.once("exit", resolve));
      }
    },
  };
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createHttpServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function rawRequest(base, path, body, headers) {
  return new Promise((resolve, reject) => {
    const target = new URL(path, base);
    const req = request(target, { method: body === undefined ? "GET" : "POST", headers }, (res) => {
      let responseBody = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { responseBody += chunk; });
      res.once("end", () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: responseBody && res.headers["content-type"]?.includes("application/json") ? JSON.parse(responseBody) : responseBody || null,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.once("error", reject);
    if (body !== undefined) req.end(body);
    else req.end();
  });
}

async function waitForServer(port, child, output) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`public server exited before startup\n${output()}`);
    try {
      const health = await rawRequest(`http://127.0.0.1:${port}`, "/healthz", undefined, {});
      if (health.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`public server did not start\n${output()}`);
}
