import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import {
  createRecoveryMaterial,
  decryptRecoveryPrivateKey,
  signRecoveryChallenge,
} from "./helpers/recovery-material.mjs";

const masterPassword = "correct horse battery staple";

test("zero-knowledge recovery rejects wrong master, prevents replay, and rotates credentials", async () => {
  const server = await startServer({ GV_RECOVERY_CHALLENGE_LIMIT: "20", GV_RECOVERY_COMPLETE_LIMIT: "20" });
  const email = `recovery-${Date.now()}@example.local`;
  const oldAccountPassword = "old-account-password-123";
  const newAccountPassword = "new-account-password-456";
  const finalAccountPassword = "final-account-password-789";
  const initial = createRecoveryMaterial(masterPassword);
  const submittedProofs = [];

  try {
    const register = await postOk(server.base, "/api/auth/register", {
      email,
      password: oldAccountPassword,
      recovery: initial.recovery,
    });
    assert.ok(register.token);

    const storedAfterRegister = await readFile(join(server.dataDir, "gvault-store.json"), "utf8");
    assert.doesNotMatch(storedAfterRegister, new RegExp(escapeRegex(masterPassword)));
    assert.doesNotMatch(storedAfterRegister, new RegExp(escapeRegex(initial.privateKey.toString("base64"))));
    assert.doesNotMatch(storedAfterRegister, new RegExp(escapeRegex(oldAccountPassword)));
    assert.match(storedAfterRegister, new RegExp(escapeRegex(initial.recovery.verifier)));

    const challenge = await postOk(server.base, "/api/auth/recovery/challenge", { email });
    assert.equal(challenge.protocol, "gvault-recovery-v1");
    assert.deepEqual(challenge.envelope, initial.recovery.envelope);
    assert.deepEqual(Object.keys(challenge).sort(), ["challenge", "challengeId", "envelope", "expiresAt", "protocol"]);
    assert.throws(() => decryptRecoveryPrivateKey(challenge.envelope, "wrong-master-password"));

    const recoveredPrivateKey = decryptRecoveryPrivateKey(challenge.envelope, masterPassword);
    assert.deepEqual(recoveredPrivateKey, initial.privateKey);
    const proof = signRecoveryChallenge(recoveredPrivateKey, challenge.challengeId, challenge.challenge);
    submittedProofs.push(proof);
    const badProof = await post(server.base, "/api/auth/recovery/complete", {
      challengeId: challenge.challengeId,
      proof: Buffer.alloc(72).toString("base64"),
      password: newAccountPassword,
      recovery: createRecoveryMaterial(masterPassword).recovery,
    });
    assert.equal(badProof.response.status, 401);
    const consumedAfterBadProof = await post(server.base, "/api/auth/recovery/complete", {
      challengeId: challenge.challengeId,
      proof,
      password: newAccountPassword,
      recovery: createRecoveryMaterial(masterPassword).recovery,
    });
    assert.equal(consumedAfterBadProof.response.status, 401, "a bad proof consumes the challenge before verification");

    const freshChallenge = await postOk(server.base, "/api/auth/recovery/challenge", { email });
    const freshProof = signRecoveryChallenge(recoveredPrivateKey, freshChallenge.challengeId, freshChallenge.challenge);
    submittedProofs.push(freshProof);
    const rotated = createRecoveryMaterial(masterPassword);
    const completed = await postOk(server.base, "/api/auth/recovery/complete", {
      challengeId: freshChallenge.challengeId,
      proof: freshProof,
      password: newAccountPassword,
      recovery: rotated.recovery,
    });
    assert.ok(completed.token);
    assert.equal(completed.userId, register.userId);

    const replay = await post(server.base, "/api/auth/recovery/complete", {
      challengeId: freshChallenge.challengeId,
      proof: freshProof,
      password: "replay-account-password",
      recovery: createRecoveryMaterial(masterPassword).recovery,
    });
    assert.equal(replay.response.status, 401);
    assert.equal(replay.payload.error, "Recovery could not be completed");

    assert.equal((await post(server.base, "/api/auth/login", { email, password: oldAccountPassword })).response.status, 401);
    assert.ok((await postOk(server.base, "/api/auth/login", { email, password: newAccountPassword })).token);

    const rotationChallenge = await postOk(server.base, "/api/auth/recovery/challenge", { email });
    const staleProof = signRecoveryChallenge(initial.privateKey, rotationChallenge.challengeId, rotationChallenge.challenge);
    submittedProofs.push(staleProof);
    const staleAttempt = await post(server.base, "/api/auth/recovery/complete", {
      challengeId: rotationChallenge.challengeId,
      proof: staleProof,
      password: finalAccountPassword,
      recovery: createRecoveryMaterial(masterPassword).recovery,
    });
    assert.equal(staleAttempt.response.status, 401, "the pre-rotation private key is no longer accepted");
    assert.equal(staleAttempt.payload.error, "Recovery could not be completed");

    const currentChallenge = await postOk(server.base, "/api/auth/recovery/challenge", { email });
    const currentPrivateKey = decryptRecoveryPrivateKey(currentChallenge.envelope, masterPassword);
    assert.deepEqual(currentPrivateKey, rotated.privateKey);
    const finalRotation = createRecoveryMaterial(masterPassword);
    const finalProof = signRecoveryChallenge(currentPrivateKey, currentChallenge.challengeId, currentChallenge.challenge);
    submittedProofs.push(finalProof);
    await postOk(server.base, "/api/auth/recovery/complete", {
      challengeId: currentChallenge.challengeId,
      proof: finalProof,
      password: finalAccountPassword,
      recovery: finalRotation.recovery,
    });
    assert.ok((await postOk(server.base, "/api/auth/login", { email, password: finalAccountPassword })).token);

    const storedAfterRotation = await readFile(join(server.dataDir, "gvault-store.json"), "utf8");
    assert.match(storedAfterRotation, new RegExp(escapeRegex(finalRotation.recovery.verifier)));
    assert.doesNotMatch(storedAfterRotation, new RegExp(escapeRegex(initial.recovery.verifier)));
    assert.doesNotMatch(storedAfterRotation, new RegExp(escapeRegex(rotated.recovery.verifier)));
    assert.doesNotMatch(storedAfterRotation, new RegExp(escapeRegex(finalRotation.privateKey.toString("base64"))));

    const unknown = await postOk(server.base, "/api/auth/recovery/challenge", { email: "unknown@example.local" });
    const unknownRepeat = await postOk(server.base, "/api/auth/recovery/challenge", { email: "unknown@example.local" });
    const anotherUnknown = await postOk(server.base, "/api/auth/recovery/challenge", { email: "another-unknown@example.local" });
    assert.deepEqual(Object.keys(unknown).sort(), Object.keys(currentChallenge).sort());
    assert.deepEqual(Object.keys(unknown.envelope).sort(), Object.keys(currentChallenge.envelope).sort());
    for (const field of ["salt", "nonce", "ciphertext"]) {
      assert.equal(unknown.envelope[field].length, currentChallenge.envelope[field].length, `${field} length does not enumerate enrollment`);
    }
    assert.deepEqual(unknownRepeat.envelope, unknown.envelope, "one unknown identifier has a stable indistinguishable dummy");
    assert.notDeepEqual(anotherUnknown.envelope, unknown.envelope, "different unknown identifiers do not share an enumerable dummy canary");
    const unknownComplete = await post(server.base, "/api/auth/recovery/complete", {
      challengeId: unknown.challengeId,
      proof: Buffer.alloc(72).toString("base64"),
      password: "unknown-new-password",
      recovery: createRecoveryMaterial(masterPassword).recovery,
    });
    assert.equal(unknownComplete.response.status, 401);
    assert.equal(unknownComplete.payload.error, "Recovery could not be completed");
  } finally {
    await server.stop();
  }

  const logs = server.output();
  for (const secret of [email, masterPassword, oldAccountPassword, newAccountPassword, finalAccountPassword, initial.privateKey.toString("base64"), ...submittedProofs]) {
    assert.doesNotMatch(logs, new RegExp(escapeRegex(secret)), "recovery audit output must not contain credentials or private recovery material");
  }
  assert.match(logs, /recovery-audit/);
});

test("existing pre-v1 accounts opt in explicitly with account-password reauthentication", async () => {
  const email = `migration-${Date.now()}@example.local`;
  const password = "existing-account-password";
  const legacyUser = makeLegacyUser(email, password);
  const server = await startServer({}, { schemaVersion: 1, users: [legacyUser], devices: [], records: [] });
  const material = createRecoveryMaterial(masterPassword);

  try {
    const beforeOptIn = await postOk(server.base, "/api/auth/recovery/challenge", { email });
    assert.throws(() => decryptRecoveryPrivateKey(beforeOptIn.envelope, masterPassword), "unenrolled legacy account receives a dummy envelope");
    const login = await postOk(server.base, "/api/auth/login", { email, password });
    const rejectedSetup = await post(server.base, "/api/auth/recovery/setup", {
      password: "wrong-existing-account-password",
      recovery: material.recovery,
    }, login.token);
    assert.equal(rejectedSetup.response.status, 401);

    const replacement = createRecoveryMaterial(masterPassword);
    const setup = await postOk(server.base, "/api/auth/recovery/setup", {
      password,
      recovery: replacement.recovery,
    }, login.token);
    assert.equal(setup.recoveryEnabled, true);
    const afterOptIn = await postOk(server.base, "/api/auth/recovery/challenge", { email });
    assert.deepEqual(afterOptIn.envelope, replacement.recovery.envelope);

    const newRegistrationWithoutRecovery = await post(server.base, "/api/auth/register", {
      email: "new-client-without-recovery@example.local",
      password: "new-client-account-password",
    });
    assert.equal(newRegistrationWithoutRecovery.response.status, 400, "new registrations must include recovery material");
  } finally {
    await server.stop();
  }
});

test("challenge and completion rate limits do not disclose enrollment", async () => {
  const server = await startServer({
    GV_RECOVERY_CHALLENGE_LIMIT: "2",
    GV_RECOVERY_COMPLETE_LIMIT: "2",
    GV_RECOVERY_WINDOW_MS: "60000",
  });
  const email = `rate-${Date.now()}@example.local`;
  const password = "rate-account-password";
  const material = createRecoveryMaterial(masterPassword);

  try {
    await postOk(server.base, "/api/auth/register", { email, password, recovery: material.recovery });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      assert.equal((await post(server.base, "/api/auth/recovery/challenge", { email })).response.status, 200);
      assert.equal((await post(server.base, "/api/auth/recovery/challenge", { email: "absent-rate@example.local" })).response.status, 200);
    }
    const knownLimited = await post(server.base, "/api/auth/recovery/challenge", { email });
    const unknownLimited = await post(server.base, "/api/auth/recovery/challenge", { email: "absent-rate@example.local" });
    assert.equal(knownLimited.response.status, 429);
    assert.equal(unknownLimited.response.status, 429);
    assert.equal(knownLimited.payload.error, "Recovery temporarily unavailable");
    assert.deepEqual(unknownLimited.payload, knownLimited.payload);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const invalid = await post(server.base, "/api/auth/recovery/complete", {
        challengeId: `absent-challenge-${attempt}`,
        proof: Buffer.alloc(72).toString("base64"),
        password: "replacement-account-password",
        recovery: createRecoveryMaterial(masterPassword).recovery,
      });
      assert.equal(invalid.response.status, 401);
    }
    const completionLimited = await post(server.base, "/api/auth/recovery/complete", {
      challengeId: "absent-challenge-limited",
      proof: Buffer.alloc(72).toString("base64"),
      password: "replacement-account-password",
      recovery: createRecoveryMaterial(masterPassword).recovery,
    });
    assert.equal(completionLimited.response.status, 429);
    assert.equal(completionLimited.payload.error, "Recovery temporarily unavailable");
  } finally {
    await server.stop();
  }
});

async function startServer(extraEnv = {}, initialState) {
  const dataDir = await mkdtemp(join(tmpdir(), "gvault-recovery-"));
  if (initialState) await writeFile(join(dataDir, "gvault-store.json"), JSON.stringify(initialState), { mode: 0o600 });
  const port = 21080 + Math.floor(Math.random() * 1000);
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, ["apps/server/dist/index.js"], {
    env: { ...process.env, GV_DATA_DIR: dataDir, GV_SERVER_HOST: "127.0.0.1", GV_SERVER_PORT: String(port), ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  await waitForServer(port, child);
  return {
    base: `http://127.0.0.1:${port}`,
    dataDir,
    output: () => `${stdout}\n${stderr}`,
    stop: async () => {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    },
  };
}

function makeLegacyUser(email, password) {
  const passwordSalt = randomBytes(16).toString("base64url");
  return {
    id: `legacy_${randomBytes(8).toString("hex")}`,
    email,
    createdAt: new Date().toISOString(),
    passwordSalt,
    passwordHash: scryptSync(password, passwordSalt, 64).toString("base64url"),
  };
}

async function post(base, path, body, token) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json().catch(() => ({})) };
}

async function postOk(base, path, body, token) {
  const result = await post(base, path, body, token);
  if (!result.response.ok) assert.fail(`${path} returned ${result.response.status}: ${JSON.stringify(result.payload)}`);
  return result.payload;
}

async function waitForServer(port, child) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited ${child.exitCode}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("recovery test server did not start");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
