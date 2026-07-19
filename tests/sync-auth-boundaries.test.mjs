import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { detectConflicts, mergeEncryptedRecords } from "../packages/sync/dist/index.js";
import { SessionStore, hashPassword, makeUser, verifyPassword } from "../apps/server/dist/auth.js";
import { createRecoveryMaterial } from "./helpers/recovery-material.mjs";

function rec(overrides) {
  return {
    id: "rec_1",
    ownerId: "user_a",
    deviceId: "dev_1",
    collection: "vault-items",
    ciphertext: "cipher-1",
    nonce: "nonce",
    schemaVersion: 1,
    deleted: false,
    updatedAt: "2026-07-01T00:00:00.000Z",
    revision: 1,
    ...overrides
  };
}

// --- sync merge boundary ---

test("mergeEncryptedRecords keeps the higher-revision record for a shared id", () => {
  const merged = mergeEncryptedRecords([rec({ revision: 1 })], [rec({ revision: 2, ciphertext: "cipher-2" })]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].revision, 2);
  assert.equal(merged[0].ciphertext, "cipher-2");
});

test("mergeEncryptedRecords keeps the newer updatedAt when revisions tie", () => {
  const older = rec({ updatedAt: "2026-07-01T00:00:00.000Z", ciphertext: "old" });
  const newer = rec({ updatedAt: "2026-07-02T00:00:00.000Z", ciphertext: "new" });
  assert.equal(mergeEncryptedRecords([older], [newer])[0].ciphertext, "new");
});

test("mergeEncryptedRecords unions distinct ids and sorts by updatedAt", () => {
  const a = rec({ id: "a", updatedAt: "2026-07-02T00:00:00.000Z" });
  const b = rec({ id: "b", updatedAt: "2026-07-01T00:00:00.000Z" });
  const merged = mergeEncryptedRecords([a], [b]);
  assert.deepEqual(merged.map((r) => r.id), ["b", "a"]);
});

// --- sync conflict boundary ---

test("detectConflicts flags an incoming record that would overwrite an equal-or-newer server revision", () => {
  const existing = [rec({ revision: 3, ciphertext: "server" })];
  const incoming = [rec({ revision: 2, ciphertext: "client" })];
  assert.deepEqual(detectConflicts(existing, incoming).map((r) => r.id), ["rec_1"]);
});

test("detectConflicts ignores identical ciphertext even at the same revision", () => {
  const existing = [rec({ revision: 2, ciphertext: "same" })];
  const incoming = [rec({ revision: 2, ciphertext: "same" })];
  assert.equal(detectConflicts(existing, incoming).length, 0);
});

test("detectConflicts treats a brand-new id as non-conflicting", () => {
  const existing = [rec({ id: "known" })];
  const incoming = [rec({ id: "fresh", ciphertext: "x" })];
  assert.equal(detectConflicts(existing, incoming).length, 0);
});

// --- auth password boundary ---

test("hashPassword rejects passwords shorter than 12 characters", () => {
  assert.throws(() => hashPassword("short"), /at least 12 characters/);
});

test("verifyPassword accepts the correct password and rejects a wrong one", () => {
  const user = makeUser("User@Example.com", "correct-horse-battery", createRecoveryMaterial("test-master-password").recovery);
  assert.equal(user.email, "user@example.com", "email is normalized at the boundary");
  assert.equal(verifyPassword("correct-horse-battery", user), true);
  assert.equal(verifyPassword("correct-horse-batteru", user), false);
});

// --- auth session boundary ---

test("SessionStore only resolves a properly-formed Bearer token", () => {
  const store = new SessionStore();
  const session = store.create("user_x");
  assert.equal(store.get(`Bearer ${session.token}`)?.userId, "user_x");
  assert.equal(store.get(session.token), undefined, "raw token without Bearer prefix is rejected");
  assert.equal(store.get("Bearer gv_not-a-real-token"), undefined);
  assert.equal(store.get(undefined), undefined);
});

test("SessionStore expires a session at its fixed lifetime boundary", () => {
  const store = new SessionStore({ ttlMs: 1_000 });
  const session = store.create("user_x", "Web browser", 10_000);

  assert.equal(session.deviceName, "Web browser");
  assert.equal(session.createdAt, "1970-01-01T00:00:10.000Z");
  assert.equal(session.expiresAt, "1970-01-01T00:00:11.000Z");
  assert.equal(store.get(`Bearer ${session.token}`, 10_999)?.id, session.id);
  assert.equal(store.get(`Bearer ${session.token}`, 11_000), undefined);
  assert.deepEqual(store.list("user_x", session.id, 11_000), []);
});

test("SessionStore keeps only the newest bounded sessions for one user", () => {
  const store = new SessionStore({ maxPerUser: 2, maxTotal: 10 });
  const oldest = store.create("user_x", "Old phone", 1_000);
  const middle = store.create("user_x", "Web browser", 2_000);
  const newest = store.create("user_x", "New phone", 3_000);

  assert.equal(store.get(`Bearer ${oldest.token}`, 3_001), undefined);
  assert.equal(store.get(`Bearer ${middle.token}`, 3_001)?.id, middle.id);
  assert.equal(store.get(`Bearer ${newest.token}`, 3_001)?.id, newest.id);
  assert.deepEqual(store.list("user_x", newest.id, 3_001).map((session) => session.id), [newest.id, middle.id]);
});

test("SessionStore enforces a global active-session capacity", () => {
  const store = new SessionStore({ maxPerUser: 10, maxTotal: 2 });
  const oldest = store.create("user_a", "Phone A", 1_000);
  const middle = store.create("user_b", "Phone B", 2_000);
  const newest = store.create("user_c", "Phone C", 3_000);

  assert.equal(store.get(`Bearer ${oldest.token}`, 3_001), undefined);
  assert.equal(store.get(`Bearer ${middle.token}`, 3_001)?.id, middle.id);
  assert.equal(store.get(`Bearer ${newest.token}`, 3_001)?.id, newest.id);
});

test("SessionStore lists safe metadata and revokes only an owning user's session", () => {
  const store = new SessionStore();
  const web = store.create("user_x", "Web browser", 1_000);
  const android = store.create("user_x", "Android Pixel 7 Pro", 2_000);
  const other = store.create("user_y", "Other device", 3_000);

  const listed = store.list("user_x", android.id, 3_001);
  assert.deepEqual(listed.map(({ id, deviceName, current }) => ({ id, deviceName, current })), [
    { id: android.id, deviceName: "Android Pixel 7 Pro", current: true },
    { id: web.id, deviceName: "Web browser", current: false },
  ]);
  assert.equal("token" in listed[0], false, "bearer tokens are never returned by session listing");
  assert.equal("userId" in listed[0], false, "internal owner ids are not returned by session listing");
  assert.equal(store.revoke("user_x", other.id, 3_001), false, "one user cannot revoke another user's session");
  assert.equal(store.revoke("user_x", web.id, 3_001), true);
  assert.equal(store.get(`Bearer ${web.token}`, 3_001), undefined);
  assert.equal(store.get(`Bearer ${android.token}`, 3_001)?.id, android.id);
  assert.equal(store.get(`Bearer ${other.token}`, 3_001)?.id, other.id);
});

// --- server-enforced tenant boundary (cross-user isolation + ownerId spoofing) ---

test("sync endpoints isolate records per user and ignore client-supplied ownerId", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "gvault-boundary-"));
  const port = 20080 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["apps/server/dist/index.js"], {
    env: { ...process.env, GV_DATA_DIR: dataDir, GV_SERVER_HOST: "127.0.0.1", GV_SERVER_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const base = `http://127.0.0.1:${port}`;
  await waitForServer(port, child);
  try {
    const alice = await post(base, "/api/auth/register", { email: "alice@example.local", password: "alice-strong-password", recovery: createRecoveryMaterial("alice-master-password").recovery });
    const bob = await post(base, "/api/auth/register", { email: "bob@example.local", password: "bob-strong-password", recovery: createRecoveryMaterial("bob-master-password").recovery });

    // Bob pushes a record that lies about its owner, claiming it belongs to Alice.
    const spoofed = { id: "rec_spoof", ownerId: alice.userId, deviceId: "dev_bob", collection: "vault-items", ciphertext: "bob-secret", nonce: "n", schemaVersion: 1, deleted: false, updatedAt: new Date().toISOString(), revision: 1 };
    const push = await post(base, "/api/sync/push", { deviceId: "dev_bob", records: [spoofed] }, bob.token);
    assert.equal(push.records.length, 1);
    assert.equal(push.records[0].ownerId, bob.userId, "server overrides client ownerId with the session user");

    // Alice must not see Bob's record despite the forged ownerId.
    const alicePull = await post(base, "/api/sync/pull", {}, alice.token);
    assert.equal(alicePull.records.length, 0, "records do not leak across users");

    // Bob still owns and can read his own record.
    const bobPull = await post(base, "/api/sync/pull", {}, bob.token);
    assert.equal(bobPull.records.length, 1);
    assert.equal(bobPull.records[0].ownerId, bob.userId);

    // No session token means no access to the sync boundary.
    const noAuth = await fetch(`${base}/api/sync/push`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(noAuth.status, 401, "sync/push requires a session token");
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
