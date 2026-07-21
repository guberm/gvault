export function combineSignerEvidence({ stdout = "", stderr = "" }) {
  return normalizeSignerEvidence([stdout, stderr].filter((value) => value.trim()).join("\n"));
}

export function extractSignerSha256(evidence) {
  const digestLine = normalizeSignerEvidence(evidence)
    .split("\n")
    .find((line) => /Signer #1 certificate SHA-256 digest:/i.test(line));
  if (!digestLine) return undefined;

  const fingerprint = digestLine
    .replace(/^.*Signer #1 certificate SHA-256 digest:\s*/i, "")
    .replace(/[^0-9a-f]/gi, "")
    .toLowerCase();
  return /^[0-9a-f]{64}$/.test(fingerprint) ? fingerprint : undefined;
}

export function normalizeSignerEvidence(value) {
  return value.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n").trim();
}
