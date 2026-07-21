import { createHash, createHmac, createPublicKey, randomBytes, scryptSync, timingSafeEqual, verify } from "node:crypto";
import { uid } from "@gvault/shared-utils";
import type { RecoveryEnvelope, RecoveryRegistration, UserRow } from "./storage.js";

export const RECOVERY_PROTOCOL = "gvault-recovery-v1";
export const RECOVERY_ITERATIONS = 210_000;
export const RECOVERY_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_MAX_PER_USER = 10;
export const SESSION_MAX_TOTAL = 10_000;
const RECOVERY_CIPHERTEXT_BYTES = 256 + 16;

export interface Session {
  id: string;
  token: string;
  userId: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export class SessionStore {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly options: { ttlMs?: number; maxPerUser?: number; maxTotal?: number } = {}) {}

  create(userId: string, deviceName = "Unknown device", now = Date.now()): Session {
    this.prune(now);
    const token = `gv_${randomBytes(32).toString("base64url")}`;
    const createdAt = new Date(now).toISOString();
    const session = {
      id: `ses_${randomBytes(18).toString("base64url")}`,
      token,
      userId,
      deviceName,
      createdAt,
      lastSeenAt: createdAt,
      expiresAt: new Date(now + (this.options.ttlMs ?? SESSION_TTL_MS)).toISOString(),
    };
    this.sessions.set(token, session);
    const userTokens = [...this.sessions]
      .filter(([, candidate]) => candidate.userId === userId)
      .map(([candidateToken]) => candidateToken);
    while (userTokens.length > (this.options.maxPerUser ?? SESSION_MAX_PER_USER)) {
      this.sessions.delete(userTokens.shift()!);
    }
    while (this.sessions.size > (this.options.maxTotal ?? SESSION_MAX_TOTAL)) {
      const oldestToken = this.sessions.keys().next().value;
      if (!oldestToken) break;
      this.sessions.delete(oldestToken);
    }
    return session;
  }

  get(token?: string, now = Date.now()): Session | undefined {
    this.prune(now);
    if (!token?.startsWith("Bearer ")) return undefined;
    const session = this.sessions.get(token.slice("Bearer ".length));
    if (session) session.lastSeenAt = new Date(now).toISOString();
    return session;
  }

  list(userId: string, currentSessionId?: string, now = Date.now()): Array<Omit<Session, "token" | "userId"> & { current: boolean }> {
    this.prune(now);
    return [...this.sessions.values()]
      .filter((session) => session.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(({ token: _token, userId: _userId, ...session }) => ({ ...session, current: session.id === currentSessionId }));
  }

  revoke(userId: string, sessionId: string, now = Date.now()): boolean {
    this.prune(now);
    for (const [token, session] of this.sessions) {
      if (session.id !== sessionId || session.userId !== userId) continue;
      this.sessions.delete(token);
      return true;
    }
    return false;
  }

  private prune(now: number): void {
    for (const [token, session] of this.sessions) {
      if (Date.parse(session.expiresAt) <= now) this.sessions.delete(token);
    }
  }
}

export function hashPassword(password: string, salt = randomBytes(16).toString("base64url")): Pick<UserRow, "passwordHash" | "passwordSalt"> {
  if (password.length < 12) throw new Error("Server account password must be at least 12 characters");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return { passwordSalt: salt, passwordHash: hash };
}

export function verifyPassword(password: string, user: Pick<UserRow, "passwordHash" | "passwordSalt">): boolean {
  const candidate = Buffer.from(scryptSync(password, user.passwordSalt, 64).toString("base64url"));
  const expected = Buffer.from(user.passwordHash);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function makeUser(email: string, password: string, recovery: RecoveryRegistration): UserRow {
  return {
    id: uid("user"),
    email: email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
    ...hashPassword(password),
    recovery: { ...recovery, updatedAt: new Date().toISOString() }
  };
}

export function redactForAudit(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function validateRecoveryRegistration(value: unknown): RecoveryRegistration {
  if (!value || typeof value !== "object") throw new Error("Recovery material is required");
  const recovery = value as Partial<RecoveryRegistration>;
  if (recovery.version !== 1 || typeof recovery.verifier !== "string") throw new Error("Recovery material is invalid");
  const verifierBytes = decodeBase64(recovery.verifier, "recovery verifier");
  if (verifierBytes.length !== 91) throw new Error("Recovery verifier is invalid");
  const publicKey = createPublicKey({ key: verifierBytes, type: "spki", format: "der" });
  if (publicKey.asymmetricKeyType !== "ec" || publicKey.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
    throw new Error("Recovery verifier is invalid");
  }
  const envelope = validateRecoveryEnvelope(recovery.envelope);
  return { version: 1, verifier: recovery.verifier, envelope };
}

export function validateRecoveryEnvelope(value: unknown): RecoveryEnvelope {
  if (!value || typeof value !== "object") throw new Error("Recovery envelope is invalid");
  const envelope = value as Partial<RecoveryEnvelope>;
  if (envelope.version !== 1 || envelope.kdf !== "PBKDF2-SHA256" || envelope.iterations !== RECOVERY_ITERATIONS) {
    throw new Error("Recovery envelope is invalid");
  }
  if (typeof envelope.salt !== "string" || decodeBase64(envelope.salt, "recovery salt").length !== 16) throw new Error("Recovery envelope is invalid");
  if (typeof envelope.nonce !== "string" || decodeBase64(envelope.nonce, "recovery nonce").length !== 12) throw new Error("Recovery envelope is invalid");
  if (typeof envelope.ciphertext !== "string" || decodeBase64(envelope.ciphertext, "recovery ciphertext").length !== RECOVERY_CIPHERTEXT_BYTES) {
    throw new Error("Recovery envelope is invalid");
  }
  return envelope as RecoveryEnvelope;
}

export function canonicalRecoveryMessage(challengeId: string, challenge: string): Buffer {
  return Buffer.from(`${RECOVERY_PROTOCOL}\n${challengeId}\n${challenge}`, "utf8");
}

export function verifyRecoveryProof(verifier: string, challengeId: string, challenge: string, proof: string): boolean {
  try {
    const publicKey = createPublicKey({ key: decodeBase64(verifier, "recovery verifier"), type: "spki", format: "der" });
    const signature = decodeBase64(proof, "recovery proof");
    return signature.length >= 64 && signature.length <= 80 && verify("sha256", canonicalRecoveryMessage(challengeId, challenge), publicKey, signature);
  } catch {
    return false;
  }
}

export interface RecoveryChallenge {
  id: string;
  challenge: string;
  userId?: string;
  expiresAtMs: number;
}

export class RecoveryChallengeStore {
  private readonly challenges = new Map<string, RecoveryChallenge>();

  create(userId?: string, now = Date.now()): RecoveryChallenge {
    this.prune(now);
    const value = {
      id: `rc_${randomBytes(24).toString("base64url")}`,
      challenge: randomBytes(32).toString("base64url"),
      userId,
      expiresAtMs: now + RECOVERY_CHALLENGE_TTL_MS,
    };
    this.challenges.set(value.id, value);
    return value;
  }

  consume(id: string, now = Date.now()): RecoveryChallenge | undefined {
    const value = this.challenges.get(id);
    this.challenges.delete(id);
    if (!value || value.expiresAtMs < now) return undefined;
    return value;
  }

  private prune(now: number): void {
    for (const [id, challenge] of this.challenges) if (challenge.expiresAtMs < now) this.challenges.delete(id);
  }
}

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxBuckets = 10_000,
  ) {}

  canAllow(key: string, now = Date.now()): boolean {
    const current = this.buckets.get(key);
    return !current || current.resetAt <= now || current.count < this.limit;
  }

  allow(key: string, now = Date.now()): boolean {
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      if (!current) this.ensureCapacity(now);
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (current.count >= this.limit) return false;
    current.count += 1;
    return true;
  }

  private ensureCapacity(now: number): void {
    if (this.buckets.size < this.maxBuckets) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
      if (this.buckets.size < this.maxBuckets) return;
    }
    const oldestKey = this.buckets.keys().next().value;
    if (oldestKey) this.buckets.delete(oldestKey);
  }
}

export function dummyRecoveryEnvelope(secret: string, subject: string): RecoveryEnvelope {
  return {
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations: RECOVERY_ITERATIONS,
    salt: deriveDummyBytes(secret, subject, "salt", 16).toString("base64"),
    nonce: deriveDummyBytes(secret, subject, "nonce", 12).toString("base64"),
    ciphertext: deriveDummyBytes(secret, subject, "ciphertext", RECOVERY_CIPHERTEXT_BYTES).toString("base64"),
  };
}

function deriveDummyBytes(secret: string, subject: string, label: string, length: number): Buffer {
  const chunks: Buffer[] = [];
  let produced = 0;
  for (let counter = 0; produced < length; counter += 1) {
    chunks.push(createHmac("sha256", secret).update(`${RECOVERY_PROTOCOL}\n${label}\n${subject}\n${counter}`).digest());
    produced += chunks[chunks.length - 1].length;
  }
  return Buffer.concat(chunks).subarray(0, length);
}

function decodeBase64(value: string, label: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error(`${label} is invalid`);
  return Buffer.from(value, "base64");
}
