import type { EncryptedVaultRecord } from "@gvault/vault-models";

export interface SyncPullRequest {
  since?: string;
  deviceId: string;
}

export interface SyncPushRequest {
  deviceId: string;
  records: EncryptedVaultRecord[];
}

export interface SyncResponse {
  serverTime: string;
  records: EncryptedVaultRecord[];
  conflicts: EncryptedVaultRecord[];
}

export function mergeEncryptedRecords(local: EncryptedVaultRecord[], remote: EncryptedVaultRecord[]): EncryptedVaultRecord[] {
  const byId = new Map<string, EncryptedVaultRecord>();
  for (const record of [...local, ...remote]) {
    const existing = byId.get(record.id);
    if (!existing || record.revision > existing.revision || record.updatedAt > existing.updatedAt) {
      byId.set(record.id, record);
    }
  }
  return [...byId.values()].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

export function detectConflicts(existing: EncryptedVaultRecord[], incoming: EncryptedVaultRecord[]): EncryptedVaultRecord[] {
  const byId = new Map(existing.map((record) => [record.id, record]));
  return incoming.filter((record) => {
    const current = byId.get(record.id);
    return current && current.revision >= record.revision && current.ciphertext !== record.ciphertext;
  });
}
