import {
  chmodSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { EncryptedVaultRecord } from "@gvault/vault-models";

export interface UserRow {
  id: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  recovery?: RecoveryRegistration & { updatedAt: string };
}

export interface RecoveryEnvelope {
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterations: 210000;
  salt: string;
  nonce: string;
  ciphertext: string;
}

export interface RecoveryRegistration {
  version: 1;
  verifier: string;
  envelope: RecoveryEnvelope;
}

export interface DeviceRow {
  id: string;
  userId: string;
  name: string;
  publicKey?: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface StoreState {
  schemaVersion: 1;
  recoveryDummySecret?: string;
  users: UserRow[];
  devices: DeviceRow[];
  records: EncryptedVaultRecord[];
}

const emptyState = (): StoreState => ({ schemaVersion: 1, users: [], devices: [], records: [] });

const lockTimeoutMs = 10_000;
const malformedLockStaleMs = 10_000;
const waitBuffer = new Int32Array(new SharedArrayBuffer(4));

interface LockOwner {
  pid: number;
  token: string;
}

export class StoreValidationError extends Error {}

export class JsonStore {
  private readonly filePath: string;
  private readonly backupPath: string;
  private readonly lockPath: string;

  constructor(dataDir: string) {
    this.filePath = join(dataDir, "gvault-store.json");
    this.backupPath = `${this.filePath}.bak`;
    this.lockPath = `${this.filePath}.lock`;
    mkdirSync(dirname(this.filePath), { recursive: true });
  }

  read(): StoreState {
    let primaryError: unknown;
    try {
      return readStateFile(this.filePath);
    } catch (error) {
      primaryError = error;
      if (!isMissingFile(error) && !isInvalidState(error)) throw error;
    }

    try {
      const recovered = readStateFile(this.backupPath);
      console.warn(`GVault JSON store recovery: ${this.filePath} is unavailable or invalid; using the validated rollback snapshot.`);
      return recovered;
    } catch (backupError) {
      if (isMissingFile(primaryError) && isMissingFile(backupError)) return emptyState();
      const reason = errorMessage(primaryError);
      throw new StoreValidationError(`JSON store primary is invalid and no valid rollback snapshot is available: ${reason}`, {
        cause: new AggregateError([primaryError, backupError])
      });
    }
  }

  /** Return false from the mutator to release the lock without committing. */
  mutate(mutator: (state: StoreState) => boolean | void): StoreState {
    const release = this.acquireLock();
    try {
      const state = this.read();
      if (mutator(state) === false) return state;
      validateStoreState(state);
      this.writeState(state);
      return state;
    } finally {
      release();
    }
  }

  private writeState(state: StoreState): void {
    const serialized = `${JSON.stringify(state, null, 2)}\n`;

    try {
      const current = readFileSync(this.filePath, "utf8");
      validateStoreState(JSON.parse(current));
      atomicWrite(this.backupPath, current);
    } catch (error) {
      if (!isMissingFile(error) && !isInvalidState(error)) throw error;
    }

    atomicWrite(this.filePath, serialized);
  }

  private acquireLock(): () => void {
    const owner: LockOwner = { pid: process.pid, token: randomUUID() };
    const startedAt = Date.now();

    while (true) {
      let descriptor: number | undefined;
      try {
        descriptor = openSync(this.lockPath, "wx", 0o600);
        writeFileSync(descriptor, JSON.stringify(owner), "utf8");
        fsyncSync(descriptor);
        closeSync(descriptor);
        descriptor = undefined;
        return () => this.releaseLock(owner);
      } catch (error) {
        if (descriptor !== undefined) closeSync(descriptor);
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
          try { unlinkSync(this.lockPath); } catch { /* The lock was never published or is already gone. */ }
          throw error;
        }
        if (this.removeDeadLock()) continue;
        if (Date.now() - startedAt >= lockTimeoutMs) {
          throw new Error(`Timed out waiting for the JSON store writer lock after ${lockTimeoutMs}ms`);
        }
        Atomics.wait(waitBuffer, 0, 0, 10);
      }
    }
  }

  private removeDeadLock(): boolean {
    let raw: string;
    try {
      raw = readFileSync(this.lockPath, "utf8");
    } catch (error) {
      return isMissingFile(error);
    }

    const owner = parseLockOwner(raw);
    if (owner && processIsAlive(owner.pid)) return false;
    if (!owner) {
      try {
        if (Date.now() - statSync(this.lockPath).mtimeMs < malformedLockStaleMs) return false;
      } catch (error) {
        return isMissingFile(error);
      }
    }

    try {
      if (readFileSync(this.lockPath, "utf8") !== raw) return false;
      const stalePath = `${this.lockPath}.stale-${process.pid}-${randomUUID()}`;
      renameSync(this.lockPath, stalePath);
      rmSync(stalePath, { force: true });
      return true;
    } catch (error) {
      if (isMissingFile(error)) return true;
      return false;
    }
  }

  private releaseLock(owner: LockOwner): void {
    try {
      const current = parseLockOwner(readFileSync(this.lockPath, "utf8"));
      if (!current || current.token !== owner.token || current.pid !== owner.pid) {
        throw new Error("JSON store writer lock ownership was lost");
      }
      unlinkSync(this.lockPath);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }
}

function readStateFile(path: string): StoreState {
  const state = JSON.parse(readFileSync(path, "utf8")) as unknown;
  validateStoreState(state);
  return state;
}

function validateStoreState(value: unknown): asserts value is StoreState {
  const state = requireObject(value, "JSON store root");
  if (state.schemaVersion !== 1) {
    throw new StoreValidationError(`Unsupported JSON store schema version ${String(state.schemaVersion)}`);
  }
  if (!Array.isArray(state.users)) throw new StoreValidationError("JSON store users must be an array");
  if (!Array.isArray(state.devices)) throw new StoreValidationError("JSON store devices must be an array");
  if (!Array.isArray(state.records)) throw new StoreValidationError("JSON store records must be an array");
  if (state.recoveryDummySecret !== undefined) requireString(state.recoveryDummySecret, "recoveryDummySecret");
  state.users.forEach((user, index) => validateUser(user, index));
  state.devices.forEach((device, index) => validateDevice(device, index));
  state.records.forEach((record, index) => validateRecord(record, index));
}

function validateUser(value: unknown, index: number): void {
  const user = requireObject(value, `users[${index}]`);
  for (const field of ["id", "email", "passwordSalt", "passwordHash", "createdAt"] as const) {
    requireString(user[field], `users[${index}].${field}`);
  }
  if (user.recovery === undefined) return;
  const recovery = requireObject(user.recovery, `users[${index}].recovery`);
  if (recovery.version !== 1) throw new StoreValidationError(`users[${index}].recovery.version must be 1`);
  requireString(recovery.verifier, `users[${index}].recovery.verifier`);
  requireString(recovery.updatedAt, `users[${index}].recovery.updatedAt`);
  const envelope = requireObject(recovery.envelope, `users[${index}].recovery.envelope`);
  if (envelope.version !== 1) throw new StoreValidationError(`users[${index}].recovery.envelope.version must be 1`);
  if (envelope.kdf !== "PBKDF2-SHA256") throw new StoreValidationError(`users[${index}].recovery.envelope.kdf is invalid`);
  if (envelope.iterations !== 210000) throw new StoreValidationError(`users[${index}].recovery.envelope.iterations is invalid`);
  for (const field of ["salt", "nonce", "ciphertext"] as const) {
    requireString(envelope[field], `users[${index}].recovery.envelope.${field}`);
  }
}

function validateDevice(value: unknown, index: number): void {
  const device = requireObject(value, `devices[${index}]`);
  for (const field of ["id", "userId", "name", "createdAt", "lastSeenAt"] as const) {
    requireString(device[field], `devices[${index}].${field}`);
  }
  if (device.publicKey !== undefined) requireString(device.publicKey, `devices[${index}].publicKey`);
}

function validateRecord(value: unknown, index: number): void {
  const record = requireObject(value, `records[${index}]`);
  for (const field of ["id", "ownerId", "deviceId", "collection", "ciphertext", "nonce", "updatedAt"] as const) {
    requireString(record[field], `records[${index}].${field}`);
  }
  if (!["vault-items", "attachments", "metadata"].includes(record.collection as string)) {
    throw new StoreValidationError(`records[${index}].collection is invalid`);
  }
  if (record.salt !== undefined) requireString(record.salt, `records[${index}].salt`);
  requireNonNegativeInteger(record.schemaVersion, `records[${index}].schemaVersion`);
  requireNonNegativeInteger(record.revision, `records[${index}].revision`);
  if (typeof record.deleted !== "boolean") throw new StoreValidationError(`records[${index}].deleted must be a boolean`);
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StoreValidationError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, path: string): void {
  if (typeof value !== "string") throw new StoreValidationError(`${path} must be a string`);
}

function requireNonNegativeInteger(value: unknown, path: string): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new StoreValidationError(`${path} must be a non-negative integer`);
  }
}

function atomicWrite(path: string, contents: string): void {
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporaryPath, "wx", 0o600);
    writeFileSync(descriptor, contents, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporaryPath, path);
    chmodSync(path, 0o600);
    syncDirectory(dirname(path));
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(temporaryPath, { force: true });
  }
}

function syncDirectory(path: string): void {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, "r");
    fsyncSync(descriptor);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!code || !["EBADF", "EINVAL", "EISDIR", "ENOTSUP", "EPERM"].includes(code)) throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function parseLockOwner(raw: string): LockOwner | undefined {
  try {
    const value = JSON.parse(raw) as Partial<LockOwner>;
    if (!Number.isSafeInteger(value.pid) || (value.pid ?? 0) <= 0 || typeof value.token !== "string") return undefined;
    return { pid: value.pid as number, token: value.token };
  } catch {
    return undefined;
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code !== "ESRCH" && code !== "EINVAL";
  }
}

function isInvalidState(error: unknown): boolean {
  return error instanceof SyntaxError || error instanceof StoreValidationError;
}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
