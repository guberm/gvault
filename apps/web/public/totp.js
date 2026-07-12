const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export async function currentTotpCode(secret, timeMs = Date.now()) {
  const keyBytes = decodeBase32(secret);
  const counter = Math.floor(timeMs / 30_000);
  const counterBytes = new Uint8Array(8);
  let value = BigInt(counter);
  for (let index = counterBytes.length - 1; index >= 0; index -= 1) {
    counterBytes[index] = Number(value & 255n);
    value >>= 8n;
  }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes));
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24)
    | (digest[offset + 1] << 16)
    | (digest[offset + 2] << 8)
    | digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

function decodeBase32(secret) {
  const normalized = String(secret).toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  if (!normalized || /[^A-Z2-7]/.test(normalized)) throw new Error("invalid-base32");
  let bits = 0;
  let bitCount = 0;
  const bytes = [];
  for (const character of normalized) {
    bits = (bits << 5) | base32Alphabet.indexOf(character);
    bitCount += 5;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bits >> bitCount) & 255);
    }
  }
  if (bytes.length === 0 || (bitCount > 0 && (bits & ((1 << bitCount) - 1)) !== 0)) throw new Error("invalid-base32");
  return new Uint8Array(bytes);
}
