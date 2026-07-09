---
title: Zero-knowledge boundary
created: 2026-07-09
updated: 2026-07-09
type: architecture
status: pilot
sources:
  - path: README.md
    note: Product summary and self-hosted/server boundary.
  - path: docs/architecture/overview.md
    note: Explicit client/server/shared-package responsibilities.
  - path: docs/security/encryption-model.md
    note: Repo-grounded encryption details and server storage boundary.
  - path: packages/crypto/src/index.ts
    note: PBKDF2/AES-GCM implementation.
  - path: packages/vault-models/src/index.ts
    note: EncryptedVaultRecord shape and visible metadata.
  - path: apps/server/src/index.ts
    note: Server API accepts and stores encrypted records.
---

# Zero-knowledge boundary

GVault's durable security boundary is: **clients decrypt; the server routes and stores encrypted records**.

Evidence from current docs/code:

- `README.md` states the server stores encrypted vault records only and master-password encryption is client-side.
- `docs/architecture/overview.md` assigns encryption, unlock, autofill, local cache, and decrypted UI state to clients; server auth, device registration, encrypted persistence, sync metadata, health, and encrypted backup/export to the server.
- `docs/security/encryption-model.md` says item contents are encrypted client-side with a key derived from the master password, while the server stores encrypted blobs plus routing metadata.
- `packages/crypto/src/index.ts` derives a non-extractable AES-GCM key via PBKDF2-SHA256, using 210,000 iterations, random salt, and random nonce.
- `packages/vault-models/src/index.ts` defines `EncryptedVaultRecord` with visible routing metadata: `id`, `ownerId`, `deviceId`, `collection`, `nonce`, `salt`, `schemaVersion`, `deleted`, `updatedAt`, and `revision`.
- `apps/server/src/index.ts` validates encrypted record fields and persists them as records; it does not import `@gvault/crypto` or decrypt item contents.

## Agent rule

When implementing server features, do not add plaintext vault-item fields to server payloads, logs, storage, backups, or search indexes. Server-visible metadata may support routing/sync, but decrypted vault content belongs in clients only.

## Related pages

- [Encrypted sync flow](../flows/encrypted-sync.md)
- [RoboForm parity truth gate](../decisions/roboform-parity-truth-gate.md)
