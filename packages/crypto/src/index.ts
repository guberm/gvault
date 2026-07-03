export interface EncryptedEnvelope {
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  nonce: string;
  ciphertext: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(value, "base64"));
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function randomBase64(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

export async function deriveVaultKey(masterPassword: string, salt = randomBase64(16), iterations = 210_000): Promise<CryptoKey> {
  if (masterPassword.length < 12) {
    throw new Error("Master password must be at least 12 characters");
  }
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    bufferSource(encoder.encode(masterPassword)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return globalThis.crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: bufferSource(base64ToBytes(salt)), iterations },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJson(value: unknown, masterPassword: string): Promise<EncryptedEnvelope> {
  const salt = randomBase64(16);
  const nonce = randomBase64(12);
  const iterations = 210_000;
  const key = await deriveVaultKey(masterPassword, salt, iterations);
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv: bufferSource(base64ToBytes(nonce)) }, key, bufferSource(plaintext));
  return {
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations,
    salt,
    nonce,
    ciphertext: bytesToBase64(new Uint8Array(ciphertext))
  };
}

export async function decryptJson<T>(envelope: EncryptedEnvelope, masterPassword: string): Promise<T> {
  const key = await deriveVaultKey(masterPassword, envelope.salt, envelope.iterations);
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bufferSource(base64ToBytes(envelope.nonce)) },
    key,
    bufferSource(base64ToBytes(envelope.ciphertext))
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
}
