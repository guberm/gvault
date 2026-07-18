# Encryption Model

Scope: the current GVault implementation in this repository. This document is
repo-grounded and describes only what the code does today. It does **not** claim
production hardening, secure sharing, device/session token lifecycle, or recovery
behavior beyond what is implemented.

## Summary

- Vault item contents are encrypted **client-side** with a key derived from the
  user's master password.
- The server stores and syncs **encrypted blobs plus routing metadata only**; it
  never receives the master password or the derived key.
- Encryption is authenticated (AES-256-GCM), so tampering with ciphertext fails
  decryption.

## Crypto envelope

Evidence: `packages/crypto/src/index.ts`, `packages/vault-models/src/index.ts`.

Vault values are serialized to JSON and sealed into an `EncryptedEnvelope`:

| Field | Value | Notes |
| --- | --- | --- |
| `version` | `1` | Envelope format version. |
| `kdf` | `PBKDF2-SHA256` | Key derivation function and hash. |
| `iterations` | `210000` | PBKDF2 iteration count. |
| `salt` | random 128-bit (base64) | New per `encryptJson` call. |
| `nonce` | random 96-bit (base64) | AES-GCM IV, new per encryption. |
| `ciphertext` | base64 | AES-256-GCM output (includes GCM auth tag). |

### Current cross-client compatibility gap

The table above is the envelope emitted by `packages/crypto`; it is not yet a
safe claim of cross-client interoperability. Web and Android currently derive
their record keys with 150,000 PBKDF2 iterations, while the shared package uses
210,000. `EncryptedVaultRecord` carries `salt` and `nonce` but not the KDF name
or iteration count. A runtime audit round trip confirmed that a 210,000-iteration
shared-package envelope cannot be decrypted by the current 150,000-iteration
Web/Android path. Versioned KDF metadata, backward compatibility, and migration
are tracked in #493.

### Key derivation

- `deriveVaultKey` runs PBKDF2-SHA256 over the master password with the envelope
  salt and iteration count, producing a 256-bit AES-GCM key.
- The derived key is created as **non-extractable** (`extractable = false`) and
  scoped to `encrypt`/`decrypt` only.
- Master passwords shorter than 12 characters are rejected before derivation.
- Salt and nonce come from `crypto.getRandomValues`.

The 12-character check is currently enforced by shared/Web code but not by the
Android `MobileAuthState`/`MobileVaultItem` path. Cross-client enforcement and
physical-device boundary proof are tracked in #486.

### Encrypt / decrypt

- `encryptJson` generates a fresh salt and nonce, derives the key, and encrypts
  with AES-256-GCM.
- `decryptJson` re-derives the key from the master password using the salt and
  iteration count stored in the envelope, then verifies and decrypts. A wrong
  master password or altered ciphertext fails the GCM authentication check.

## What is and is not encrypted

Synced records use `EncryptedVaultRecord` (`packages/vault-models/src/index.ts`).

**Encrypted (inside `ciphertext`):**

- Vault item plaintext — login credentials, secure notes, identity, payment
  card, address, and custom fields.

**Not encrypted (record metadata, visible to the server):**

- `id`, `ownerId`, `deviceId`
- `collection` (`vault-items` | `attachments` | `metadata`)
- `nonce`, `salt`, `schemaVersion`
- `deleted`, `updatedAt`, `revision`

The server uses this metadata for routing, ownership scoping, sync merge, and
conflict detection. It cannot read item contents because it never holds the
master password or derived key.

## Server storage boundary

Evidence: `apps/server/src/index.ts`, `apps/server/src/storage.ts`.

- The server accepts, stores, and returns encrypted records; it does not decrypt
  them.
- Encrypted records are persisted in `GV_DATA_DIR/gvault-store.json` with `0600`
  writes.
- The server account password (login to the API) uses `scrypt` and is **separate
  from the master password** used for vault encryption.

## Out of scope for this document

These are tracked separately and are not claimed complete here:

- Authentication model, device/session token lifecycle — see
  [threat-model.md](./threat-model.md).
- Secure sharing crypto — not implemented.
- Recovery of a lost master password — see
  [recovery-limitations.md](./recovery-limitations.md).
- Encryption-at-rest for the server JSON store beyond `0600` file mode — see
  [threat-model.md](./threat-model.md).

## What was checked

- `packages/crypto/src/index.ts` — KDF, envelope fields, AES-GCM encrypt/decrypt.
- `packages/vault-models/src/index.ts` — `EncryptedEnvelope` and
  `EncryptedVaultRecord` shapes (encrypted vs. metadata fields).
- `apps/server/src/index.ts`, `apps/server/src/storage.ts` — encrypted-blob
  storage and account-password separation.
