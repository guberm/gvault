export function combineSignerEvidence({ stdout = "", stderr = "" }) {
  return normalizeSignerEvidence([stdout, stderr].filter((value) => value.trim()).join("\n"));
}

export function extractSignerSha256(evidence) {
  const normalized = normalizeSignerEvidence(evidence);
  const sha256Label = normalized.search(/SHA-?256/i);
  if (sha256Label === -1) return undefined;

  const candidate = normalized
    .slice(sha256Label)
    .match(/(?:[0-9a-f]{2}(?:[:\s-]?)){32}/i)?.[0];
  const fingerprint = candidate?.replace(/[^0-9a-f]/gi, "").toLowerCase();
  return /^[0-9a-f]{64}$/.test(fingerprint) ? fingerprint : undefined;
}

export function normalizeSignerEvidence(value) {
  return value.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n").trim();
}
