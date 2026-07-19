import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  generateKeyPairSync,
  pbkdf2Sync,
  randomBytes,
  sign,
} from "node:crypto";

export const RECOVERY_PROTOCOL = "gvault-recovery-v1";
export const RECOVERY_ITERATIONS = 210_000;
export const RECOVERY_PLAINTEXT_BYTES = 256;

export function canonicalRecoveryMessage(challengeId, challenge) {
  return `${RECOVERY_PROTOCOL}\n${challengeId}\n${challenge}`;
}

export function createRecoveryMaterial(masterPassword) {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const key = pbkdf2Sync(masterPassword, salt, RECOVERY_ITERATIONS, 32, "sha256");
  assertPrivateKeyFits(privateKey);
  const plaintext = randomBytes(RECOVERY_PLAINTEXT_BYTES);
  plaintext.writeUInt16BE(privateKey.length, 0);
  privateKey.copy(plaintext, 2);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(RECOVERY_PROTOCOL));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  return {
    privateKey,
    recovery: {
      version: 1,
      verifier: publicKey.toString("base64"),
      envelope: {
        version: 1,
        kdf: "PBKDF2-SHA256",
        iterations: RECOVERY_ITERATIONS,
        salt: salt.toString("base64"),
        nonce: nonce.toString("base64"),
        ciphertext: ciphertext.toString("base64"),
      },
    },
  };
}

export function decryptRecoveryPrivateKey(envelope, masterPassword) {
  const salt = Buffer.from(envelope.salt, "base64");
  const nonce = Buffer.from(envelope.nonce, "base64");
  const encrypted = Buffer.from(envelope.ciphertext, "base64");
  const key = pbkdf2Sync(masterPassword, salt, envelope.iterations, 32, "sha256");
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(Buffer.from(RECOVERY_PROTOCOL));
  decipher.setAuthTag(encrypted.subarray(encrypted.length - 16));
  const plaintext = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]);
  if (plaintext.length !== RECOVERY_PLAINTEXT_BYTES) throw new Error("Invalid recovery payload length");
  const privateKeyLength = plaintext.readUInt16BE(0);
  if (privateKeyLength < 1 || privateKeyLength > RECOVERY_PLAINTEXT_BYTES - 2) throw new Error("Invalid recovery key length");
  return plaintext.subarray(2, 2 + privateKeyLength);
}

export function signRecoveryChallenge(privateKey, challengeId, challenge) {
  return sign("sha256", Buffer.from(canonicalRecoveryMessage(challengeId, challenge)), {
    key: createPrivateKey({ key: privateKey, type: "pkcs8", format: "der" }),
    dsaEncoding: "der",
  }).toString("base64");
}

function assertPrivateKeyFits(privateKey) {
  if (privateKey.length < 1 || privateKey.length > RECOVERY_PLAINTEXT_BYTES - 2) {
    throw new Error("Recovery private key encoding is too large");
  }
}
