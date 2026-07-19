import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectConflicts } from "@gvault/sync";
import { nowIso, requireNonEmpty, uid } from "@gvault/shared-utils";
import type { EncryptedVaultRecord } from "@gvault/vault-models";
import {
  dummyRecoveryEnvelope,
  FixedWindowRateLimiter,
  hashPassword,
  makeUser,
  RECOVERY_PROTOCOL,
  RecoveryChallengeStore,
  redactForAudit,
  SESSION_MAX_PER_USER,
  SESSION_MAX_TOTAL,
  SESSION_TTL_MS,
  type Session,
  SessionStore,
  validateRecoveryRegistration,
  verifyPassword,
  verifyRecoveryProof,
} from "./auth.js";
import { JsonStore } from "./storage.js";

const product = "GVault";
const dataDir = process.env.GV_DATA_DIR ?? "./data";
const allowedOrigins = new Set((process.env.GV_ALLOWED_ORIGINS ?? "*").split(",").map((origin) => origin.trim()));
const store = new JsonStore(dataDir);
const sessions = new SessionStore({
  ttlMs: positiveInteger(process.env.GV_SESSION_TTL_MS, SESSION_TTL_MS),
  maxPerUser: positiveInteger(process.env.GV_SESSION_MAX_PER_USER, SESSION_MAX_PER_USER),
  maxTotal: positiveInteger(process.env.GV_SESSION_MAX_TOTAL, SESSION_MAX_TOTAL),
});
const recoveryChallenges = new RecoveryChallengeStore();
const recoveryWindowMs = positiveInteger(process.env.GV_RECOVERY_WINDOW_MS, 15 * 60 * 1000);
const recoveryChallengeLimiter = new FixedWindowRateLimiter(positiveInteger(process.env.GV_RECOVERY_CHALLENGE_LIMIT, 5), recoveryWindowMs);
const recoveryCompleteLimiter = new FixedWindowRateLimiter(positiveInteger(process.env.GV_RECOVERY_COMPLETE_LIMIT, 5), recoveryWindowMs);
const recoveryState = store.read();
if (!recoveryState.recoveryDummySecret) {
  recoveryState.recoveryDummySecret = randomBytes(32).toString("base64url");
  store.write(recoveryState);
}
const recoveryDummySecret = recoveryState.recoveryDummySecret;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

function recoveryAudit(req: IncomingMessage, event: string, outcome: string, subject = "unknown"): void {
  console.info(`[recovery-audit] ${JSON.stringify({
    at: nowIso(),
    event,
    outcome,
    subject: redactForAudit(subject),
    source: redactForAudit(req.socket.remoteAddress ?? "unknown"),
  })}`);
}

function recoveryLimitKey(req: IncomingMessage, subject = ""): string {
  return `${redactForAudit(subject)}:${redactForAudit(req.socket.remoteAddress ?? "unknown")}`;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function setCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (allowedOrigins.has("*") || (origin && allowedOrigins.has(origin))) {
    res.setHeader("access-control-allow-origin", origin ?? "*");
  }
  res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization");
}

function requireSession(req: IncomingMessage, res: ServerResponse): Session | undefined {
  const session = sessions.get(req.headers.authorization);
  if (!session) {
    sendError(res, 401, "Unauthorized");
    return undefined;
  }
  return session;
}

function sessionDeviceName(value: unknown): string {
  if (typeof value !== "string") return "Unknown device";
  const normalized = value.trim().replace(/[\r\n\t]+/g, " ");
  return normalized ? normalized.slice(0, 128) : "Unknown device";
}

function sessionResponse(session: Session, userId: string): Record<string, string> {
  return { token: session.token, userId, sessionId: session.id, expiresAt: session.expiresAt };
}

function assertEncryptedRecord(value: unknown, ownerId: string): EncryptedVaultRecord {
  if (!value || typeof value !== "object") throw new Error("Invalid encrypted record");
  const record = value as Partial<EncryptedVaultRecord>;
  for (const field of ["id", "deviceId", "collection", "ciphertext", "nonce", "updatedAt"] as const) {
    if (typeof record[field] !== "string") throw new Error(`Encrypted record ${field} is required`);
  }
  const collection = record.collection;
  if (!collection || !["vault-items", "attachments", "metadata"].includes(collection)) {
    throw new Error("Encrypted record collection is invalid");
  }
  return {
    id: record.id,
    ownerId,
    deviceId: record.deviceId,
    collection,
    ciphertext: record.ciphertext,
    nonce: record.nonce,
    salt: record.salt,
    schemaVersion: Number(record.schemaVersion ?? 1),
    deleted: Boolean(record.deleted),
    updatedAt: record.updatedAt,
    revision: Number(record.revision ?? 1)
  } as EncryptedVaultRecord;
}

export async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/healthz") {
    sendJson(res, 200, { ok: true, product, storage: "json-file", time: nowIso() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readJson(req);
    let email: string;
    let password: string;
    let recovery;
    try {
      email = requireNonEmpty(body.email, "email").toLowerCase();
      password = requireNonEmpty(body.password, "password");
      recovery = validateRecoveryRegistration(body.recovery);
    } catch (error) {
      sendError(res, 400, error instanceof Error ? error.message : "Registration is invalid");
      return;
    }
    const state = store.read();
    if (state.users.some((user) => user.email === email)) {
      sendError(res, 409, "Account already exists");
      return;
    }
    let user;
    try {
      user = makeUser(email, password, recovery);
    } catch (error) {
      sendError(res, 400, error instanceof Error ? error.message : "Registration is invalid");
      return;
    }
    state.users.push(user);
    store.write(state);
    const session = sessions.create(user.id, sessionDeviceName(body.deviceName));
    sendJson(res, 201, sessionResponse(session, user.id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readJson(req);
    const email = requireNonEmpty(body.email, "email").toLowerCase();
    const password = requireNonEmpty(body.password, "password");
    const user = store.read().users.find((candidate) => candidate.email === email);
    if (!user || !verifyPassword(password, user)) {
      sendError(res, 401, "Invalid credentials");
      return;
    }
    const session = sessions.create(user.id, sessionDeviceName(body.deviceName));
    sendJson(res, 200, sessionResponse(session, user.id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/recovery/challenge") {
    const body = await readJson(req);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!recoveryChallengeLimiter.allow(recoveryLimitKey(req, email))) {
      recoveryAudit(req, "challenge", "limited", email);
      sendError(res, 429, "Recovery temporarily unavailable");
      return;
    }
    const state = store.read();
    const user = state.users.find((candidate) => candidate.email === email);
    const challenge = recoveryChallenges.create(user?.recovery ? user.id : undefined);
    recoveryAudit(req, "challenge", "issued", email);
    sendJson(res, 200, {
      protocol: RECOVERY_PROTOCOL,
      challengeId: challenge.id,
      challenge: challenge.challenge,
      expiresAt: new Date(challenge.expiresAtMs).toISOString(),
      envelope: user?.recovery?.envelope ?? dummyRecoveryEnvelope(recoveryDummySecret, email),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/recovery/complete") {
    const body = await readJson(req);
    if (!recoveryCompleteLimiter.allow(recoveryLimitKey(req))) {
      recoveryAudit(req, "complete", "limited");
      sendError(res, 429, "Recovery temporarily unavailable");
      return;
    }
    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
    const proof = typeof body.proof === "string" ? body.proof : "";
    const challenge = recoveryChallenges.consume(challengeId);
    const state = store.read();
    const user = challenge?.userId ? state.users.find((candidate) => candidate.id === challenge.userId) : undefined;
    const validProof = Boolean(
      challenge && user?.recovery && verifyRecoveryProof(user.recovery.verifier, challenge.id, challenge.challenge, proof),
    );
    if (!validProof || !user || !challenge) {
      recoveryAudit(req, "complete", "denied", user?.email);
      sendError(res, 401, "Recovery could not be completed");
      return;
    }
    let password: string;
    let recovery;
    try {
      password = requireNonEmpty(body.password, "password");
      recovery = validateRecoveryRegistration(body.recovery);
      if (recovery.verifier === user.recovery?.verifier) throw new Error("Recovery material must rotate");
      Object.assign(user, hashPassword(password), { recovery: { ...recovery, updatedAt: nowIso() } });
    } catch (error) {
      recoveryAudit(req, "complete", "invalid-rotation", user.email);
      sendError(res, 400, error instanceof Error ? error.message : "Recovery material is invalid");
      return;
    }
    store.write(state);
    const session = sessions.create(user.id, sessionDeviceName(body.deviceName));
    recoveryAudit(req, "complete", "succeeded", user.email);
    sendJson(res, 200, sessionResponse(session, user.id));
    return;
  }

  const session = requireSession(req, res);
  if (!session) return;
  const userId = session.userId;

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    sessions.revoke(userId, session.id);
    sendJson(res, 200, { loggedOut: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/auth/sessions") {
    sendJson(res, 200, { sessions: sessions.list(userId, session.id) });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/auth/sessions/")) {
    const sessionId = url.pathname.slice("/api/auth/sessions/".length);
    if (!sessionId || !sessions.revoke(userId, sessionId)) {
      sendError(res, 404, "Session not found");
      return;
    }
    sendJson(res, 200, { revoked: true, sessionId });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/recovery/setup") {
    const body = await readJson(req);
    const state = store.read();
    const user = state.users.find((candidate) => candidate.id === userId);
    const password = typeof body.password === "string" ? body.password : "";
    if (!user || !verifyPassword(password, user)) {
      recoveryAudit(req, "setup", "denied", user?.email);
      sendError(res, 401, "Invalid credentials");
      return;
    }
    let recovery;
    try {
      recovery = validateRecoveryRegistration(body.recovery);
      if (recovery.verifier === user.recovery?.verifier) throw new Error("Recovery material must rotate");
    } catch (error) {
      sendError(res, 400, error instanceof Error ? error.message : "Recovery material is invalid");
      return;
    }
    user.recovery = { ...recovery, updatedAt: nowIso() };
    store.write(state);
    recoveryAudit(req, "setup", "succeeded", user.email);
    sendJson(res, 200, { recoveryEnabled: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/devices/register") {
    const body = await readJson(req);
    const state = store.read();
    const device = {
      id: uid("dev"),
      userId,
      name: requireNonEmpty(body.name, "name"),
      publicKey: typeof body.publicKey === "string" ? body.publicKey : undefined,
      createdAt: nowIso(),
      lastSeenAt: nowIso()
    };
    state.devices.push(device);
    store.write(state);
    sendJson(res, 201, device);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sync/pull") {
    const body = await readJson(req);
    const since = typeof body.since === "string" ? body.since : undefined;
    const records = store.read().records.filter((record) => record.ownerId === userId && (!since || record.updatedAt > since));
    sendJson(res, 200, { serverTime: nowIso(), records, conflicts: [] });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sync/push") {
    const body = await readJson(req);
    const incoming = Array.isArray(body.records) ? body.records.map((record) => assertEncryptedRecord(record, userId)) : [];
    const state = store.read();
    const existing = state.records.filter((record) => record.ownerId === userId);
    const conflicts = detectConflicts(existing, incoming);
    const conflictIds = new Set(conflicts.map((record) => record.id));
    for (const record of incoming.filter((item) => !conflictIds.has(item.id))) {
      const index = state.records.findIndex((candidate) => candidate.ownerId === userId && candidate.id === record.id);
      if (index >= 0) state.records[index] = record;
      else state.records.push(record);
    }
    store.write(state);
    const records = store.read().records.filter((record) => record.ownerId === userId);
    sendJson(res, 200, { serverTime: nowIso(), records, conflicts });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/backup/export") {
    const state = store.read();
    const backup = {
      product,
      exportedAt: nowIso(),
      users: state.users.filter((user) => user.id === userId).map((user) => ({ id: user.id, email: user.email })),
      devices: state.devices.filter((device) => device.userId === userId),
      records: state.records.filter((record) => record.ownerId === userId)
    };
    mkdirSync(join(dataDir, "backups"), { recursive: true });
    const path = join(dataDir, "backups", `backup-${Date.now()}.json`);
    writeFileSync(path, JSON.stringify(backup, null, 2), { encoding: "utf8", mode: 0o600 });
    sendJson(res, 200, { ...backup, path });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/backup/import") {
    const body = await readJson(req);
    const path = requireNonEmpty(body.path, "path");
    const backup = JSON.parse(readFileSync(path, "utf8")) as { records?: EncryptedVaultRecord[] };
    const state = store.read();
    for (const record of backup.records ?? []) {
      state.records.push({ ...record, ownerId: userId });
    }
    store.write(state);
    sendJson(res, 200, { importedRecords: backup.records?.length ?? 0 });
    return;
  }

  sendError(res, 404, "Not found");
}

const host = process.env.GV_SERVER_HOST ?? "127.0.0.1";
const port = Number(process.env.GV_SERVER_PORT ?? "8080");

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createServer((req, res) => {
    route(req, res).catch(() => sendError(res, 500, "Internal server error"));
  }).listen(port, host, () => {
    console.log(`${product} server listening on http://${host}:${port}`);
  });
}
