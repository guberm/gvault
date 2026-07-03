# Architecture Overview

GVault is a self-hosted, zero-knowledge vault.

## Boundaries

- Clients own encryption, unlock, autofill, local cache, and decrypted UI state.
- Server owns user account auth, device registration, encrypted blob persistence, sync metadata, health, and backup/export of encrypted data.
- Shared packages own item models, validation, crypto envelope helpers, sync merge/conflict helpers, API client, and generator logic.

## Data model

Vault item types:
- login;
- secure note;
- identity;
- payment card;
- address/contact;
- custom item.

The server stores `EncryptedVaultRecord` objects. It does not receive decrypted vault fields.

## Sync

The MVP sync path is revision-based encrypted record push/pull:
- `POST /api/sync/pull`;
- `POST /api/sync/push`;
- conflict detection when an incoming record does not advance the stored revision and ciphertext differs.

Future production sync should add per-device vector clocks and explicit conflict records in the client UI.
