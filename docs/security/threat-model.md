# Threat Model

Scope: the current GVault implementation in this repository. This document is
repo-grounded and intentionally does **not** claim that every planned RoboForm
parity security feature is complete.

## System model

| Component | Evidence | Notes |
| --- | --- | --- |
| Web/mobile/desktop/browser clients | `apps/web/public/app.js`, `apps/mobile/android`, `apps/desktop`, `apps/browser-extension` | Clients collect plaintext vault fields while unlocked and encrypt/decrypt vault records locally. |
| Crypto envelope | `packages/crypto/src/index.ts` | PBKDF2-SHA256, 210,000 iterations, AES-256-GCM, random salt and nonce. |
| Sync model | `packages/sync/src/index.ts`, `apps/server/src/index.ts` | Server accepts encrypted records, detects revision conflicts, and scopes records by authenticated user. |
| Server API | `apps/server/src/index.ts` | HTTP API for health, auth, device registration, sync, backup export/import. |
| Server auth/session store | `apps/server/src/auth.ts` | Server account password uses `scrypt`; bearer session tokens are random `gv_` tokens kept in memory. Account recovery stores a public P-256 verifier and master-protected private-key envelope, never the master password or private recovery token. |
| JSON storage | `apps/server/src/storage.ts` | Stores users, devices, and encrypted records in `GV_DATA_DIR/gvault-store.json` with `0600` writes. |

## Assets

| Asset | Sensitivity | Where | Why it matters |
| --- | --- | --- | --- |
| Vault item plaintext | Critical | Client memory while unlocked | Contains passwords, notes, identity, card, and address fields. |
| Encrypted vault records | High | Client state, sync API, JSON store, backups | Offline attackers can attempt brute force if they also know/guess the master password. |
| Master password | Critical | Client input/memory only | Derives the vault key; it is not sent to the server. |
| Server account credential | High | Client input; server verifies hash | Authenticates to the server API but is separate from the master password. |
| Recovery private key | Critical | Client memory; master-protected recovery envelope | Authorizes account-password reset by signing a one-time server challenge. It is never sent to or stored as plaintext by the server. |
| Recovery public verifier and envelope | High | Server JSON store; public recovery challenge response | The verifier checks proofs; the envelope permits offline master-password guessing but does not reveal the private key without successful AEAD decryption. |
| Session token | High | Client local storage / process memory; server in-memory session map | Bearer token grants API access until fixed expiry, explicit revocation/logout, capacity eviction, or server restart. |
| Backup JSON files | High | `GV_DATA_DIR/backups` | Include encrypted records and account/device metadata for the authenticated user. |
| Server data directory | High | `GV_DATA_DIR` | Integrity and confidentiality boundary for users, hashes, devices, records, backups. |

## Trust boundaries and entry points

| Boundary / entry point | Evidence | Existing controls | Gaps / residual risk |
| --- | --- | --- | --- |
| Browser/client local runtime | `apps/web/public/app.js` | Master password remains client-side; vault records are encrypted before sync. | Plaintext exists in memory while unlocked; web client stores bearer token in `localStorage`. |
| Client to server API | `apps/server/src/index.ts` | Bearer token required for sync/device/backup routes; record `ownerId` is set from session, not client input. | Server default CORS allows `*` unless `GV_ALLOWED_ORIGINS` is configured. |
| Server auth endpoints | `apps/server/src/index.ts`, `apps/server/src/auth.ts` | Account passwords are minimum 12 characters, salted with random salt, hashed with `scrypt`, and compared with `timingSafeEqual`. JSON bodies are capped; registration/login/setup have account and source limits before `scrypt`; recovery uses single-use expiring challenges, proof verification, rotation, generic enumeration-resistant failures, audit redaction, and recovery-specific limits. | Limiter state is process-local; distributed enforcement, persistent lockout, and abuse alerting remain deployment hardening. |
| Crypto envelope | `packages/crypto/src/index.ts` | AES-256-GCM authenticated encryption; PBKDF2-SHA256; random 128-bit salt and 96-bit nonce; Web and Android reject master passwords shorter than 12 characters. | Shared crypto uses 210,000 iterations while Web/Android use 150,000 and record metadata does not carry KDF parameters (#493). |
| Sync write path | `apps/server/src/index.ts`, `packages/sync/src/index.ts` | Validates encrypted-record shape and collection; detects equal/newer revision conflicts; scopes stored records to session user. | Server cannot validate encrypted payload semantics without plaintext access. |
| Backup export/import | `apps/server/src/index.ts` | Export is authenticated and includes only current user records; import rewrites record ownership to the authenticated user. | Import reads a server-local `path` supplied by the authenticated client; this is acceptable for current smoke tooling but should be replaced by upload/object selection before production claims. |
| Server storage | `apps/server/src/storage.ts` | Atomic temp-file rename and `0600` writes. | JSON-file storage is not a hardened multi-user database and does not provide encryption-at-rest by itself. |
| Deployment TLS/reverse proxy | `docs/deployment/self-hosted.md`, live service evidence in Proof/E2E docs | Public service is intended to run behind HTTPS. | TLS termination and host hardening are deployment responsibilities; the live response currently lacks CSP, HSTS, `nosniff`, Referrer-Policy, and Permissions-Policy (#491). |
| Android Autofill cache | `MobileAutofillSessionStore.java`, `MobileAutofillSessionPolicy.java`, `GVaultAutofillService.java` | Cached values are encrypted with an Android Keystore AES-256-GCM key, require an in-process unlock grant, expire after 15 minutes, and are cleared on app start, sign-out, expiry, or decryption failure. Legacy plaintext preference keys are removed before unlock/load. | Plaintext still exists in process memory while the user has an active unlock grant; a compromised unlocked device remains outside this cache-at-rest mitigation. |

## Threats and mitigations

| Priority | Threat | Abuse path | Impact | Existing mitigation | Remaining action |
| --- | --- | --- | --- | --- | --- |
| High | Server or storage breach attempts to read vault contents | Attacker steals `gvault-store.json` / backups | Encrypted vault records exposed for offline attack | Vault fields are encrypted client-side; server stores encrypted blobs only. | Keep master password guidance strong; consider stronger KDF/memory-hard parameters before production hardening. |
| High | Online account-password guessing | Attacker repeatedly calls login endpoint | Account takeover and access to encrypted records/backups | `scrypt` hashes, constant-time comparison, and pre-scrypt per-account/per-source fixed-window limits. | Add persistent/distributed lockout, telemetry, and abuse monitoring. |
| High | Stolen server recovery data is replayed | Attacker steals the public verifier and encrypted private-key envelope | Account-password reset attempt | The verifier is public-key material rather than a reusable secret; completing recovery requires an ECDSA proof from the master-decrypted private key. Challenges are expiring and single-use. | Protect master-password strength; monitor recovery audit outcomes. |
| High | Recovery endpoint enumerates accounts | Attacker compares challenge/reset responses | Account discovery and targeted guessing | Known, unknown, and unenrolled accounts receive the same challenge shape and generic proof failure; dummy envelopes and equal rate-limit policy are used. | Production monitoring should alert on distributed enumeration attempts. |
| High | Bearer-token theft from client | XSS/local malware/browser profile theft reads `gv.token` | API access as user until token invalid | Tokens are 256-bit random, scoped by session, fixed-expiry, and revocable. | Prefer platform secure storage where available; keep XSS surface small. |
| High | Authenticated backup import path abuse | User supplies unexpected server-local path to `/api/backup/import` | Reads/imports records from unintended server-local JSON file if accessible | Route is authenticated; imported record ownership is rewritten to current user. | Replace path-based import with uploaded backup content or server-managed backup IDs. |
| Medium | Cross-origin abuse in permissive deployments | `GV_ALLOWED_ORIGINS=*` accepts browser requests from any origin | Increases impact of stolen tokens / malicious pages | Authorization header is still required for protected API routes. | Configure explicit origins for public deployments. |
| Medium | Sync conflict / replay misuse | Client pushes older or conflicting encrypted records | Data integrity loss or stale records | `detectConflicts` blocks equal/newer server revision overwrite with different ciphertext. | Add richer conflict UX, audit trail, and device/session history. |
| Medium | Lower-revision replay wins by timestamp | A stale record has a later `updatedAt` | A lower revision replaces a higher revision in shared merge | Revisions and timestamps are both available. | Make revision authoritative and use timestamp only for equal revisions (#494). |
| Medium | Local device compromise while unlocked | Malware/screenscraper reads client memory or DOM | Plaintext vault exposure | Lock/unlock state exists; server does not hold plaintext. | Native secure storage, biometric unlock, local encrypted cache, and OS-level hardening remain incomplete. |
| Medium | Browser autofill field confusion | Malicious page tricks extension/autofill matching | Credential fill into wrong origin/form | Existing Autofill tests cover feasible paths; setup guidance now exists. | Dedicated browser autofill security review remains open. |
| Low | Server data corruption | Process crash or concurrent local writers affect JSON store | Availability/integrity incident | Schema-v1 validation, exclusive local writer lock, unique temp files, fsync-backed atomic replacement, and a validated rollback snapshot. | Monitor recovery warnings, follow the tested backup/restore runbook, and use a transactional database for multi-node scale-out. |

## Non-goals and limits

- This threat model does not certify full RoboForm parity or production security.
- Account recovery resets only the server account password. It cannot recover a
  lost master password or decrypt vault records without that password.
- It does not close separate checklist items for encryption model, authentication
  model, zero-knowledge boundary, master password handling, key derivation,
  device/session token model, secure sharing crypto, backup/restore security, or
  recovery limitations.
- It assumes the public deployment terminates HTTPS correctly. The Node server
  itself is not a TLS endpoint.

## Recommended follow-up actions

- [ ] Configure production `GV_ALLOWED_ORIGINS` to explicit trusted origins.
- [x] Bound JSON bodies and add process-local account/source authentication rate limits before synchronous password work. (#485)
- [ ] Add persistent/distributed account lockout, telemetry, and abuse monitoring.
- [x] Add zero-knowledge account-password recovery using a master-protected,
  client-held signing key, single-use challenges, rotation, audit redaction,
  enumeration resistance, and recovery-specific rate limits. (#501)
- [x] Add session expiry, revocation, and device/session management. (#483)
- [x] Encrypt and expire Android Autofill cache data; remove legacy plaintext values. (#484; Pixel 7 Pro restart/sign-out acceptance)
- [ ] Version and align cross-client KDF parameters.
- [ ] Enforce dot-boundary domain matching and revision-first sync merging.
- [ ] Add production browser security headers and mandatory CI gates.
- [ ] Replace path-based backup import with upload content or server-managed backup IDs.
- [ ] Complete the dedicated docs for authentication model, zero-knowledge boundary, key derivation, backup/restore security, and recovery limits.
- [ ] Perform a dedicated browser autofill security review.

## What was checked

- `apps/server/src/index.ts` — routes, auth boundary, sync scoping, backup export/import, CORS defaults.
- `apps/server/src/auth.ts` — password hashing, token generation, session lookup.
- `apps/server/src/storage.ts` — JSON store file mode and write path.
- `packages/crypto/src/index.ts` — KDF/envelope parameters and AES-GCM behavior.
- `packages/sync/src/index.ts` — merge/conflict behavior.
- `apps/web/public/app.js` — token storage and client-side sync/auth behavior.
- `docs/security/security-model.md` and parity docs for current stated scope.
