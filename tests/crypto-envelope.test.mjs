import test from "node:test";
import assert from "node:assert/strict";
import { decryptJson, deriveVaultKey, encryptJson, randomBase64 } from "../packages/crypto/dist/index.js";

const MASTER = "correct horse battery staple";

test("envelope carries the documented metadata boundary (v1, PBKDF2-SHA256, 210k iterations)", async () => {
  const envelope = await encryptJson({ secret: "value" }, MASTER);
  assert.equal(envelope.version, 1);
  assert.equal(envelope.kdf, "PBKDF2-SHA256");
  assert.equal(envelope.iterations, 210_000);
  // 16-byte salt and 12-byte GCM nonce, base64-encoded.
  assert.equal(Buffer.from(envelope.salt, "base64").length, 16);
  assert.equal(Buffer.from(envelope.nonce, "base64").length, 12);
  assert.ok(envelope.ciphertext.length > 0);
});

test("round-trips arbitrary JSON values including unicode and nesting", async () => {
  const value = { a: 1, b: ["x", "y"], c: { d: "日本語 🔐", e: null } };
  const envelope = await encryptJson(value, MASTER);
  assert.deepEqual(await decryptJson(envelope, MASTER), value);
});

test("ciphertext never contains the plaintext", async () => {
  const envelope = await encryptJson({ secret: "topsecretvalue" }, MASTER);
  assert.equal(envelope.ciphertext.includes("topsecretvalue"), false);
});

test("wrong master password is rejected", async () => {
  const envelope = await encryptJson({ secret: "value" }, MASTER);
  await assert.rejects(() => decryptJson(envelope, "wrong horse battery staple"));
});

test("each encryption uses a fresh random salt and nonce", async () => {
  const a = await encryptJson({ secret: "value" }, MASTER);
  const b = await encryptJson({ secret: "value" }, MASTER);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.ciphertext, b.ciphertext);
});

test("tampered ciphertext fails the GCM authentication tag", async () => {
  const envelope = await encryptJson({ secret: "value" }, MASTER);
  const bytes = Buffer.from(envelope.ciphertext, "base64");
  bytes[0] ^= 0x01;
  const tampered = { ...envelope, ciphertext: bytes.toString("base64") };
  await assert.rejects(() => decryptJson(tampered, MASTER));
});

test("tampered nonce fails to decrypt", async () => {
  const envelope = await encryptJson({ secret: "value" }, MASTER);
  const bytes = Buffer.from(envelope.nonce, "base64");
  bytes[0] ^= 0x01;
  await assert.rejects(() => decryptJson({ ...envelope, nonce: bytes.toString("base64") }, MASTER));
});

test("wrong salt in envelope derives a different key and fails", async () => {
  const envelope = await encryptJson({ secret: "value" }, MASTER);
  await assert.rejects(() => decryptJson({ ...envelope, salt: randomBase64(16) }, MASTER));
});

test("iteration mismatch on decrypt derives a different key and fails", async () => {
  const envelope = await encryptJson({ secret: "value" }, MASTER);
  await assert.rejects(() => decryptJson({ ...envelope, iterations: 100_000 }, MASTER));
});

test("deriveVaultKey enforces the 12-character master password floor", async () => {
  await assert.rejects(() => deriveVaultKey("short"), /at least 12 characters/);
  // encryptJson goes through deriveVaultKey, so it inherits the guard.
  await assert.rejects(() => encryptJson({ secret: "value" }, "tooshort"));
});

test("randomBase64 returns the requested byte length and is non-deterministic", () => {
  assert.equal(Buffer.from(randomBase64(16), "base64").length, 16);
  assert.equal(Buffer.from(randomBase64(12), "base64").length, 12);
  assert.notEqual(randomBase64(16), randomBase64(16));
});
