import test from "node:test";
import assert from "node:assert/strict";
import { generatePassphrase, generatePassword, estimatePasswordStrength, findLoginsForUrl } from "../packages/core/dist/index.js";
import { decryptJson, encryptJson } from "../packages/crypto/dist/index.js";

test("password generator and strength indicator work", () => {
  const generated = generatePassword({ length: 24, uppercase: true, lowercase: true, numbers: true, symbols: true });
  assert.equal(generated.length, 24);
  assert.equal(estimatePasswordStrength(generated), "strong");
  assert.equal(generatePassphrase(4).split("-").length, 4);
});

test("crypto envelope decrypts only with the master password", async () => {
  const envelope = await encryptJson({ secret: "value" }, "correct horse battery staple");
  assert.notEqual(envelope.ciphertext.includes("value"), true);
  assert.deepEqual(await decryptJson(envelope, "correct horse battery staple"), { secret: "value" });
  await assert.rejects(() => decryptJson(envelope, "wrong horse battery staple"));
});

test("URL matching finds login records by normalized host", () => {
  const items = [{
    id: "item_1",
    type: "login",
    title: "Example",
    username: "demo",
    password: "secret",
    urls: ["https://example.com/login"],
    tags: [],
    favorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customFields: []
  }];
  assert.equal(findLoginsForUrl(items, "https://www.example.com/account").length, 1);
});
