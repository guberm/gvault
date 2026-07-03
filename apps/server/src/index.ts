import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectConflicts } from "@gvault/sync";
import { nowIso, requireNonEmpty, uid } from "@gvault/shared-utils";
import type { EncryptedVaultRecord } from "@gvault/vault-models";
import { makeUser, SessionStore, verifyPassword } from "./auth.js";
import { JsonStore } from "./storage.js";

const product = "GVault";
const dataDir = process.env.GV_DATA_DIR ?? "./data";
const allowedOrigins = new Set((process.env.GV_ALLOWED_ORIGINS ?? "*").split(",").map((origin) => origin.trim()));
const store = new JsonStore(dataDir);
const sessions = new SessionStore();

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
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
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization");
}

function requireSession(req: IncomingMessage, res: ServerResponse): string | undefined {
  const session = sessions.get(req.headers.authorization);
  if (!session) {
    sendError(res, 401, "Unauthorized");
    return undefined;
  }
  return session.userId;
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
    const email = requireNonEmpty(body.email, "email").toLowerCase();
    const password = requireNonEmpty(body.password, "password");
    const state = store.read();
    if (state.users.some((user) => user.email === email)) {
      sendError(res, 409, "Account already exists");
      return;
    }
    const user = makeUser(email, password);
    state.users.push(user);
    store.write(state);
    const session = sessions.create(user.id);
    sendJson(res, 201, { token: session.token, userId: user.id });
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
    const session = sessions.create(user.id);
    sendJson(res, 200, { token: session.token, userId: user.id });
    return;
  }

  const userId = requireSession(req, res);
  if (!userId) return;

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
