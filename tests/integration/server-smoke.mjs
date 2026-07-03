import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

test("server health, auth, sync, and backup smoke", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "gvault-"));
  const port = 19080 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["apps/server/dist/index.js"], {
    env: { ...process.env, GV_DATA_DIR: dataDir, GV_SERVER_HOST: "127.0.0.1", GV_SERVER_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForServer(port, child);
  try {
    const base = `http://127.0.0.1:${port}`;
    const health = await (await fetch(`${base}/healthz`)).json();
    assert.equal(health.product, "GVault");

    const register = await post(base, "/api/auth/register", { email: "smoke@example.local", password: "change-me-strong-password" });
    assert.ok(register.token);

    const record = {
      id: "rec_1",
      ownerId: register.userId,
      deviceId: "dev_smoke",
      collection: "vault-items",
      ciphertext: "encrypted-only",
      nonce: "nonce",
      schemaVersion: 1,
      deleted: false,
      updatedAt: new Date().toISOString(),
      revision: 1
    };
    const push = await post(base, "/api/sync/push", { deviceId: "dev_smoke", records: [record] }, register.token);
    assert.equal(push.records.length, 1);
    const backup = await post(base, "/api/backup/export", {}, register.token);
    assert.equal(backup.records[0].ciphertext, "encrypted-only");
  } finally {
    child.kill();
  }
});

async function post(base, path, body, token) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  });
  if (!response.ok) assert.fail(`${path} returned ${response.status}: ${await response.text()}`);
  return response.json();
}

async function waitForServer(port, child) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("server did not start");
}
