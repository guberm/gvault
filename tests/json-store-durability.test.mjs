import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { JsonStore } from "../apps/server/dist/storage.js";

const storeModuleUrl = pathToFileURL(resolve("apps/server/dist/storage.js")).href;

function validState(users = []) {
  return { schemaVersion: 1, users, devices: [], records: [] };
}

function user(id) {
  return {
    id,
    email: `${id}@example.test`,
    passwordSalt: `salt-${id}`,
    passwordHash: `hash-${id}`,
    createdAt: "2026-07-21T00:00:00.000Z"
  };
}

async function temporaryStore(t) {
  const dataDir = await mkdtemp(join(tmpdir(), "gvault-json-store-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  return dataDir;
}

test("JSON store rejects unsupported or malformed persisted schemas", async (t) => {
  const dataDir = await temporaryStore(t);
  const path = join(dataDir, "gvault-store.json");

  await writeFile(path, JSON.stringify({ ...validState(), schemaVersion: 2 }), { mode: 0o600 });
  assert.throws(() => new JsonStore(dataDir).read(), /Unsupported JSON store schema version 2/);

  await writeFile(path, JSON.stringify({ ...validState(), users: {} }), { mode: 0o600 });
  assert.throws(() => new JsonStore(dataDir).read(), /users must be an array/);
});

test("JSON store recovers the last valid state when the primary file is corrupt", async (t) => {
  const dataDir = await temporaryStore(t);
  const path = join(dataDir, "gvault-store.json");
  await writeFile(`${path}.bak`, JSON.stringify(validState([user("backup-user")])), { mode: 0o600 });
  await writeFile(path, '{"schemaVersion":1,"users":[', { mode: 0o600 });

  const state = new JsonStore(dataDir).read();

  assert.deepEqual(state.users.map((entry) => entry.id), ["backup-user"]);
});

test("JSON store preserves a valid rollback snapshot before replacing the primary file", async (t) => {
  const dataDir = await temporaryStore(t);
  const store = new JsonStore(dataDir);

  store.mutate((state) => { state.users.push(user("first")); });
  store.mutate((state) => { state.users.push(user("second")); });

  const current = JSON.parse(await readFile(join(dataDir, "gvault-store.json"), "utf8"));
  const rollback = JSON.parse(await readFile(join(dataDir, "gvault-store.json.bak"), "utf8"));
  assert.deepEqual(current.users.map((entry) => entry.id), ["first", "second"]);
  assert.deepEqual(rollback.users.map((entry) => entry.id), ["first"]);
});

test("JSON store removes a dead writer lock and completes the next mutation", async (t) => {
  const dataDir = await temporaryStore(t);
  const lockPath = join(dataDir, "gvault-store.json.lock");
  await writeFile(lockPath, JSON.stringify({ pid: 2147483647, token: "interrupted-writer" }), { mode: 0o600 });

  const state = new JsonStore(dataDir).mutate((draft) => { draft.users.push(user("recovered")); });

  assert.deepEqual(state.users.map((entry) => entry.id), ["recovered"]);
});

test("JSON store serializes concurrent writers across processes without lost updates", async (t) => {
  const dataDir = await temporaryStore(t);
  const workerCount = 12;

  await Promise.all(Array.from({ length: workerCount }, (_, index) => runWorker(dataDir, `worker-${index}`)));

  const state = new JsonStore(dataDir).read();
  assert.equal(state.users.length, workerCount);
  assert.deepEqual(state.users.map((entry) => entry.id).sort(), Array.from({ length: workerCount }, (_, index) => `worker-${index}`).sort());
});

function runWorker(dataDir, id) {
  const script = `
    import { JsonStore } from ${JSON.stringify(storeModuleUrl)};
    const store = new JsonStore(${JSON.stringify(dataDir)});
    store.mutate((state) => {
      const holdUntil = Date.now() + 20;
      while (Date.now() < holdUntil) {}
      state.users.push(${JSON.stringify(user(id))});
    });
  `;
  return new Promise((resolveWorker, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolveWorker();
      else reject(new Error(`Writer ${id} exited ${code}: ${stderr.trim()}`));
    });
  });
}
