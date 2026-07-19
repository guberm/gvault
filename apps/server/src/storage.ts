import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
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

export class JsonStore {
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = join(dataDir, "gvault-store.json");
    mkdirSync(dirname(this.filePath), { recursive: true });
  }

  read(): StoreState {
    try {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as StoreState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
      throw error;
    }
  }

  write(state: StoreState): void {
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
    renameSync(tmp, this.filePath);
  }
}
