import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createRecoveryMaterial } from "./helpers/recovery-material.mjs";

test("session APIs list safe device metadata and revoke an owned session", async () => {
  const server = await startServer();
  try {
    const web = await request(server.base, "/api/auth/register", {
      method: "POST",
      body: {
        email: "session-api@example.local",
        password: "session-api-account-password",
        recovery: createRecoveryMaterial("session-api-master-password").recovery,
        deviceName: "Web browser",
      },
    });
    assert.equal(web.status, 201);
    assert.match(web.body.sessionId, /^ses_/);
    assert.match(web.body.expiresAt, /^\d{4}-\d{2}-\d{2}T/);

    const android = await request(server.base, "/api/auth/login", {
      method: "POST",
      body: {
        email: "session-api@example.local",
        password: "session-api-account-password",
        deviceName: "Android Pixel 7 Pro",
      },
    });
    assert.equal(android.status, 200);
    assert.match(android.body.sessionId, /^ses_/);

    const listed = await request(server.base, "/api/auth/sessions", { token: web.body.token });
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.sessions.map(({ deviceName, current }) => ({ deviceName, current })), [
      { deviceName: "Android Pixel 7 Pro", current: false },
      { deviceName: "Web browser", current: true },
    ]);
    assert.equal(JSON.stringify(listed.body).includes(web.body.token), false, "listing never leaks the current bearer token");
    assert.equal(JSON.stringify(listed.body).includes(android.body.token), false, "listing never leaks another bearer token");

    const revoked = await request(server.base, `/api/auth/sessions/${encodeURIComponent(android.body.sessionId)}`, {
      method: "DELETE",
      token: web.body.token,
    });
    assert.deepEqual({ status: revoked.status, revoked: revoked.body.revoked }, { status: 200, revoked: true });

    const rejected = await request(server.base, "/api/sync/pull", { method: "POST", body: {}, token: android.body.token });
    assert.equal(rejected.status, 401, "a revoked bearer token is rejected immediately");
  } finally {
    await server.stop();
  }
});

test("logout revokes the current bearer token", async () => {
  const server = await startServer();
  try {
    const registered = await request(server.base, "/api/auth/register", {
      method: "POST",
      body: {
        email: "logout@example.local",
        password: "logout-account-password",
        recovery: createRecoveryMaterial("logout-master-password").recovery,
        deviceName: "Web browser",
      },
    });
    assert.equal(registered.status, 201);

    const logout = await request(server.base, "/api/auth/logout", { method: "POST", body: {}, token: registered.body.token });
    assert.deepEqual({ status: logout.status, body: logout.body }, { status: 200, body: { loggedOut: true } });

    const rejected = await request(server.base, "/api/sync/pull", { method: "POST", body: {}, token: registered.body.token });
    assert.equal(rejected.status, 401, "logout invalidates the same bearer token immediately");
  } finally {
    await server.stop();
  }
});

test("server rejects a bearer token at the configured expiry boundary", async () => {
  const server = await startServer({ GV_SESSION_TTL_MS: "50" });
  try {
    const registered = await request(server.base, "/api/auth/register", {
      method: "POST",
      body: {
        email: "expiry@example.local",
        password: "expiry-account-password",
        recovery: createRecoveryMaterial("expiry-master-password").recovery,
        deviceName: "Expiry test",
      },
    });
    assert.equal(registered.status, 201);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const rejected = await request(server.base, "/api/sync/pull", { method: "POST", body: {}, token: registered.body.token });
    assert.equal(rejected.status, 401, "an expired bearer token cannot reach a protected route");
  } finally {
    await server.stop();
  }
});

async function startServer(environment = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), "gvault-session-api-"));
  const port = 23080 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["apps/server/dist/index.js"], {
    env: {
      ...process.env,
      GV_DATA_DIR: dataDir,
      GV_SERVER_HOST: "127.0.0.1",
      GV_SERVER_PORT: String(port),
      ...environment,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(port, child);
  return {
    base: `http://127.0.0.1:${port}`,
    stop: async () => {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    },
  };
}

async function request(base, path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function waitForServer(port, child) {
  const deadline = Date.now() + 5_000;
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
