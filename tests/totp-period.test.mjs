import test from "node:test";
import assert from "node:assert/strict";

import { totpSecondsRemaining } from "../apps/web/public/totp.js";

test("TOTP period starts at 30 seconds and never exposes a stale zero", () => {
  assert.equal(totpSecondsRemaining(0), 30);
  assert.equal(totpSecondsRemaining(1), 30);
  assert.equal(totpSecondsRemaining(999), 30);
  assert.equal(totpSecondsRemaining(1_000), 29);
  assert.equal(totpSecondsRemaining(29_999), 1);
  assert.equal(totpSecondsRemaining(30_000), 30);
  assert.equal(totpSecondsRemaining(59_999), 1);
  assert.equal(totpSecondsRemaining(60_000), 30);
});
