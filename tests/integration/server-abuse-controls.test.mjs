import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { createServer as createHttpServer, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRecoveryMaterial } from "../helpers/recovery-material.mjs";
import { FixedWindowRateLimiter } from "../../apps/server/dist/auth.js";

test("bounds fixed-window rate-limit buckets by evicting the oldest key", () => {
  const limiter = new FixedWindowRateLimiter(1, 60_000, 2);
  assert.equal(limiter.allow("account-one", 1_000), true);
  assert.equal(limiter.allow("account-two", 1_000), true);
  assert.equal(limiter.allow("account-three", 1_000), true);
  assert.equal(limiter.allow("account-one", 1_000), true, "oldest bucket was evicted at capacity");
});

test("rejects a declared JSON request body larger than the configured limit", async () => {
  const server = await startServer({ GV_JSON_BODY_LIMIT_BYTES: "64" });
  const body = JSON.stringify({ email: "body-limit@example.local", password: "wrong-password", padding: "x".repeat(128) });

  try {
    const response = await rawRequest(server.base, "/api/auth/login", body, {
      "content-length": Buffer.byteLength(body),
      "content-type": "application/json",
    });
    assert.equal(response.status, 413);
    assert.deepEqual(response.body, { error: "Request body too large" });
  } finally {
    await server.stop();
  }
});

test("rejects a chunked JSON request body larger than the configured limit", async () => {
  const server = await startServer({ GV_JSON_BODY_LIMIT_BYTES: "64" });
  const body = JSON.stringify({ email: "chunked-limit@example.local", password: "wrong-password", padding: "x".repeat(128) });

  try {
    const response = await rawRequest(server.base, "/api/auth/login", body, {
      "content-type": "application/json",
      "transfer-encoding": "chunked",
    });
    assert.equal(response.status, 413);
    assert.deepEqual(response.body, { error: "Request body too large" });
  } finally {
    await server.stop();
  }
});

test("returns a client error for malformed JSON", async () => {
  const server = await startServer();

  try {
    const response = await rawRequest(server.base, "/api/auth/login", "{not-json", {
      "content-type": "application/json",
    });
    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "Malformed JSON" });
  } finally {
    await server.stop();
  }
});

test("returns a client error for syntactically valid non-object JSON", async () => {
  const server = await startServer();

  try {
    for (const body of ["null", "[]", "true", "42", '"text"']) {
      const response = await rawRequest(server.base, "/api/auth/login", body, {
        "content-type": "application/json",
      });
      assert.equal(response.status, 400);
      assert.deepEqual(response.body, { error: "JSON body must be an object" });
    }
  } finally {
    await server.stop();
  }
});

test("rejects an oversized chunked body before the client finishes uploading", async () => {
  const server = await startServer({ GV_JSON_BODY_LIMIT_BYTES: "64" });
  const pending = openRawRequest(server.base, "/api/auth/login", {
    "content-type": "application/json",
    "transfer-encoding": "chunked",
  });

  try {
    pending.req.write("x".repeat(128));
    const response = await withTimeout(pending.response, 1_000, "server waited for the oversized upload to finish");
    assert.equal(response.status, 413);
  } finally {
    pending.req.destroy();
    await pending.response.catch(() => {});
    await server.stop();
  }
});

test("limits repeated authentication for one account without blocking another account", async () => {
  const first = makeUser("limited-account@example.local", "limited-account-password");
  const second = makeUser("independent-account@example.local", "independent-account-password");
  const server = await startServer({
    GV_AUTH_ACCOUNT_LIMIT: "2",
    GV_AUTH_ORIGIN_LIMIT: "100",
    GV_AUTH_WINDOW_MS: "60000",
  }, storeWith(first, second));

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      assert.equal((await postJson(server.base, "/api/auth/login", {
        email: first.email,
        password: "wrong-password",
      })).status, 401);
    }
    const limited = await postJson(server.base, "/api/auth/login", {
      email: first.email,
      password: first.password,
    });
    assert.equal(limited.status, 429);
    assert.deepEqual(limited.body, { error: "Authentication temporarily unavailable" });

    const independent = await postJson(server.base, "/api/auth/login", {
      email: second.email,
      password: second.password,
    });
    assert.equal(independent.status, 200);
    assert.ok(independent.body.token);
  } finally {
    await server.stop();
  }
});

test("an account-limit rejection does not consume the request-origin budget", async () => {
  const first = makeUser("account-budget-one@example.local", "account-budget-one-password");
  const second = makeUser("account-budget-two@example.local", "account-budget-two-password");
  const server = await startServer({
    GV_AUTH_ACCOUNT_LIMIT: "1",
    GV_AUTH_ORIGIN_LIMIT: "2",
    GV_AUTH_WINDOW_MS: "60000",
  }, storeWith(first, second));

  try {
    assert.equal((await login(server.base, first)).status, 401);
    assert.equal((await login(server.base, first)).status, 429);
    const independent = await postJson(server.base, "/api/auth/login", {
      email: second.email,
      password: second.password,
    });
    assert.equal(independent.status, 200);
  } finally {
    await server.stop();
  }
});

test("an origin-limit rejection does not consume the account budget", async () => {
  const user = makeUser("origin-budget@example.local", "origin-budget-password");
  const server = await startServer({
    GV_AUTH_ACCOUNT_LIMIT: "2",
    GV_AUTH_ORIGIN_LIMIT: "1",
    GV_AUTH_WINDOW_MS: "60000",
    GV_TRUST_PROXY: "true",
  }, storeWith(user));

  try {
    assert.equal((await login(server.base, user, "198.51.100.20")).status, 401);
    assert.equal((await login(server.base, user, "198.51.100.20")).status, 429);
    assert.equal((await login(server.base, user, "198.51.100.21")).status, 401);
  } finally {
    await server.stop();
  }
});

test("limits one trusted forwarded origin without blocking a different origin", async () => {
  const users = [
    makeUser("origin-one@example.local", "origin-one-password"),
    makeUser("origin-two@example.local", "origin-two-password"),
    makeUser("origin-three@example.local", "origin-three-password"),
  ];
  const server = await startServer({
    GV_AUTH_ACCOUNT_LIMIT: "100",
    GV_AUTH_ORIGIN_LIMIT: "2",
    GV_AUTH_WINDOW_MS: "60000",
    GV_TRUST_PROXY: "true",
  }, storeWith(...users));

  try {
    for (const user of users.slice(0, 2)) {
      assert.equal((await login(server.base, user, "198.51.100.10")).status, 401);
    }
    assert.equal((await login(server.base, users[2], "198.51.100.10")).status, 429);
    assert.equal((await login(server.base, users[2], "198.51.100.11")).status, 401);
  } finally {
    await server.stop();
  }
});

test("ignores forwarded origins unless trusted proxy mode is enabled", async () => {
  const first = makeUser("untrusted-one@example.local", "untrusted-one-password");
  const second = makeUser("untrusted-two@example.local", "untrusted-two-password");
  const server = await startServer({
    GV_AUTH_ACCOUNT_LIMIT: "100",
    GV_AUTH_ORIGIN_LIMIT: "1",
    GV_AUTH_WINDOW_MS: "60000",
    GV_TRUST_PROXY: "false",
  }, storeWith(first, second));

  try {
    assert.equal((await login(server.base, first, "203.0.113.10")).status, 401);
    const limited = await login(server.base, second, "203.0.113.11");
    assert.equal(limited.status, 429, "spoofed forwarding headers share the socket source limit");
  } finally {
    await server.stop();
  }
});

test("limits registration scrypt work by request origin across unique accounts", async () => {
  const server = await startServer({
    GV_AUTH_ACCOUNT_LIMIT: "100",
    GV_AUTH_ORIGIN_LIMIT: "1",
    GV_AUTH_WINDOW_MS: "60000",
  });

  try {
    const first = await postJson(server.base, "/api/auth/register", {
      email: "register-one@example.local",
      password: "register-one-password",
      recovery: createRecoveryMaterial("register-one-master").recovery,
    });
    assert.equal(first.status, 201);

    const limited = await postJson(server.base, "/api/auth/register", {
      email: "register-two@example.local",
      password: "register-two-password",
      recovery: createRecoveryMaterial("register-two-master").recovery,
    });
    assert.equal(limited.status, 429);
  } finally {
    await server.stop();
  }
});

test("counts duplicate registration attempts against authentication limits", async () => {
  const existing = makeUser("duplicate-register@example.local", "duplicate-register-password");
  const server = await startServer({
    GV_AUTH_ACCOUNT_LIMIT: "100",
    GV_AUTH_ORIGIN_LIMIT: "1",
    GV_AUTH_WINDOW_MS: "60000",
  }, storeWith(existing));

  try {
    const duplicate = await postJson(server.base, "/api/auth/register", {
      email: existing.email,
      password: existing.password,
      recovery: createRecoveryMaterial("duplicate-register-master").recovery,
    });
    assert.equal(duplicate.status, 409);

    const limited = await postJson(server.base, "/api/auth/register", {
      email: "new-after-duplicate@example.local",
      password: "new-after-duplicate-password",
      recovery: createRecoveryMaterial("new-after-duplicate-master").recovery,
    });
    assert.equal(limited.status, 429);
  } finally {
    await server.stop();
  }
});

test("limits authenticated recovery setup before repeated password scrypt work", async () => {
  const user = makeUser("setup-limit@example.local", "setup-limit-password");
  const server = await startServer({
    GV_AUTH_ACCOUNT_LIMIT: "2",
    GV_AUTH_ORIGIN_LIMIT: "100",
    GV_AUTH_WINDOW_MS: "60000",
  }, storeWith(user));

  try {
    const loginResponse = await postJson(server.base, "/api/auth/login", {
      email: user.email,
      password: user.password,
    });
    assert.equal(loginResponse.status, 200);

    const denied = await postJson(server.base, "/api/auth/recovery/setup", {
      password: "wrong-password",
      recovery: createRecoveryMaterial("setup-denied-master").recovery,
    }, { authorization: `Bearer ${loginResponse.body.token}` });
    assert.equal(denied.status, 401);

    const limited = await postJson(server.base, "/api/auth/recovery/setup", {
      password: user.password,
      recovery: createRecoveryMaterial("setup-limited-master").recovery,
    }, { authorization: `Bearer ${loginResponse.body.token}` });
    assert.equal(limited.status, 429);
  } finally {
    await server.stop();
  }
});

async function startServer(environment = {}, initialState) {
  const dataDir = await mkdtemp(join(tmpdir(), "gvault-abuse-controls-"));
  if (initialState) {
    await writeFile(join(dataDir, "gvault-store.json"), JSON.stringify(initialState), { mode: 0o600 });
  }
  const port = await reservePort();
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
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  try {
    await waitForServer(port, child, () => output);
  } catch (error) {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
    throw error;
  }
  return {
    base: `http://127.0.0.1:${port}`,
    stop: async () => {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
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

function login(base, user, forwardedFor) {
  return postJson(base, "/api/auth/login", {
    email: user.email,
    password: "wrong-password",
  }, forwardedFor ? { "x-forwarded-for": forwardedFor } : {});
}

function postJson(base, path, body, headers = {}) {
  const serialized = JSON.stringify(body);
  return rawRequest(base, path, serialized, {
    "content-length": Buffer.byteLength(serialized),
    "content-type": "application/json",
    ...headers,
  });
}

function makeUser(email, password) {
  const passwordSalt = randomBytes(16).toString("base64url");
  return {
    id: `user_${randomBytes(8).toString("hex")}`,
    email,
    password,
    passwordSalt,
    passwordHash: scryptSync(password, passwordSalt, 64).toString("base64url"),
    createdAt: new Date().toISOString(),
  };
}

function storeWith(...users) {
  return {
    schemaVersion: 1,
    users: users.map(({ password: _password, ...user }) => user),
    devices: [],
    records: [],
  };
}

function rawRequest(base, path, body, headers = {}) {
  const pending = openRawRequest(base, path, headers);
  pending.req.end(body);
  return pending.response;
}

function openRawRequest(base, path, headers = {}) {
  const url = new URL(path, base);
  let req;
  const response = new Promise((resolve, reject) => {
    req = request(url, { method: "POST", headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, body: text ? JSON.parse(text) : {} });
      });
    });
    req.on("error", reject);
  });
  return { req, response };
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function waitForServer(port, child, output) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited ${child.exitCode}: ${output()}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error(`server did not start: ${output()}`);
}
