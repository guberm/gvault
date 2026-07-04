import test from "node:test";
import assert from "node:assert/strict";
import { generatePassphrase, generatePassword, estimatePasswordStrength, findLoginsForUrl, parseCsvRows, parseLoginCsv, parseRoboFormCsv } from "../packages/core/dist/index.js";
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

test("CSV parser handles quoted commas and escaped quotes", () => {
  assert.deepEqual(parseCsvRows('Name,Note\n"Bank, Inc.","say ""hello"""'), [["Name", "Note"], ["Bank, Inc.", 'say "hello"']]);
});

test("RoboForm CSV import maps login rows without leaking plaintext in metadata", () => {
  const csv = [
    "Name,Url,MatchUrl,Login,Pwd,Note,Folder,RfFieldsV2",
    'Example,"https://example.com/login","https://example.com/*",user@example.com,"secret,with,comma","private note",Work,"email,,email,txt,user@example.com,password,,password,pwd,secret"',
    'Only Url,https://only.example/login,,only-user,only-pass,,,""'
  ].join("\n");

  const result = parseRoboFormCsv(csv, () => "2026-07-04T00:00:00.000Z");
  assert.equal(result.items.length, 2);
  assert.equal(result.skippedRows, 0);
  assert.equal(result.items[0].type, "login");
  assert.equal(result.items[0].title, "Example");
  assert.equal(result.items[0].folder, "Work");
  assert.equal(result.items[0].username, "user@example.com");
  assert.equal(result.items[0].password, "secret,with,comma");
  assert.deepEqual(result.items[0].urls, ["https://example.com/login", "https://example.com/*"]);
  assert.equal(result.items[0].customFields.length, 2);
  assert.equal(result.items[0].customFields[1].concealed, true);
  assert.deepEqual(result.items[0].tags, ["roboform-import"]);
});

test("generic CSV import maps common login columns", () => {
  const csv = [
    "Title,URL,Username,Password,Notes,Folder",
    'GitHub,https://github.com/login,octo@example.com,"secret,with,comma",Main account,Work',
    "Docs,https://docs.example.com,reader,reader-pass,,Reference"
  ].join("\n");

  const result = parseLoginCsv(csv, () => "2026-07-04T00:00:00.000Z");
  assert.equal(result.source, "generic-csv");
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].title, "GitHub");
  assert.equal(result.items[0].username, "octo@example.com");
  assert.equal(result.items[0].password, "secret,with,comma");
  assert.equal(result.items[0].notes, "Main account");
  assert.equal(result.items[0].folder, "Work");
  assert.deepEqual(result.items[0].tags, ["csv-import"]);
});

test("generic CSV import rejects files without login columns", () => {
  assert.throws(() => parseLoginCsv("Column,Value\nfoo,bar"), /missing title\/name, url, username\/login, password\/pwd/i);
});
