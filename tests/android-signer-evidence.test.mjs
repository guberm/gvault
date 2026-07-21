import test from "node:test";
import assert from "node:assert/strict";

import {
  combineSignerEvidence,
  extractSignerSha256,
} from "../scripts/ci/android-signer-evidence.mjs";

const trustedFingerprint = "e73b8d51308aaf53d92ab9075838fb7de5438d436c89227cb147b94f4655d6f4";

test("Android signer evidence accepts apksigner certificate output written to stderr", () => {
  const evidence = combineSignerEvidence({
    stdout: "",
    stderr: `Signer #1 certificate SHA-256 digest: ${trustedFingerprint}\r\n`,
  });

  assert.equal(evidence, `Signer #1 certificate SHA-256 digest: ${trustedFingerprint}`);
  assert.equal(extractSignerSha256(evidence), trustedFingerprint);
});

test("Android signer fingerprint tolerates separators without accepting a different digest", () => {
  const separated = trustedFingerprint.match(/.{1,2}/g).join(":");

  assert.equal(
    extractSignerSha256(`Signer #1 certificate SHA-256 digest: ${separated}`),
    trustedFingerprint,
  );
  assert.equal(
    extractSignerSha256("Signer #1 certificate SHA-1 digest: d69545afdcb9fa9123d615e1aeb7bfdc6983ff3e"),
    undefined,
  );
});

test("Android signer fingerprint survives a native stderr line wrap", () => {
  const separated = trustedFingerprint.match(/.{1,2}/g).join("-");
  const wrappedEvidence = [
    "apksigner.bat : Signer #1 certificate SHA-256 digest:",
    separated,
    "Signer #1 certificate SHA-1 digest: d69545afdcb9fa9123d615e1aeb7bfdc6983ff3e",
  ].join("\n");

  assert.equal(extractSignerSha256(wrappedEvidence), trustedFingerprint);
});
