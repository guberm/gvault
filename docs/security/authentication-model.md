# Authentication Model

Scope: the current GVault implementation in this repository. This document is
repo-grounded and describes only the authentication behavior implemented today.
It does **not** claim production hardening, device/session-token lifecycle
features, secure sharing, or master-password recovery beyond what the code does.

## Summary

GVault has two separate password concepts:

- **Server account password**: authenticates a user to the API. The server stores
  only a salted `scrypt` password hash.
- **Vault master password**: derives the client-side encryption key for vault
  records. It is not sent to the server and is covered by
  [encryption-model.md](./encryption-model.md).

Successful registration or login returns an in-memory bearer token. Protected API
routes require that token in an HTTP authorization header using the Bearer scheme.

## Client credential flow

The account and vault steps are deliberately separate on every implemented
client:

| Action | Account password | Master password | Server receives master password |
| --- | --- | --- | --- |
| Create account/vault | Required | Required with confirmation | No |
| Regular account login | Required | Not read or validated | No |
| Unlock/restore encrypted vault after login | Not re-sent | Required | No |
| Recover forgotten account password | New password chosen | Required locally to sign one-time challenge | No |
| Existing-account recovery opt-in/rotation | Re-entered for authorization | Already unlocked locally | No |

Web and Android authenticate a restore candidate by pulling the encrypted vault
and successfully decrypting every record, including deleted-record tombstones,
before exposing decrypted state or enabling Autofill. Restore is pull-only and
does not push ciphertext under an unverified candidate key. A brand-new vault
with no encrypted records or tombstones has no ciphertext with which to verify
the candidate; adding an explicit key-verification marker remains future work.

Web and Android implement this contract. Registration establishes both the
server session and the initial local vault unlock. A later regular login creates
only the server session; sync, decryption, and Autofill remain locked until the
separate local vault-unlock step succeeds. Browser extension, Windows, and Linux
do not yet implement real account authentication and must follow this contract
when those flows are added.

## Account registration

Evidence: `apps/server/src/index.ts`, `apps/server/src/auth.ts`,
`apps/server/src/storage.ts`.

`POST /api/auth/register`:

1. Reads `email`, `password`, and recovery public verifier/envelope from the JSON body.
2. Lowercases the email for lookup/storage.
3. Rejects duplicate emails with `409 Account already exists`.
4. Creates a `UserRow` with:
   - `id`: generated `user_*` id;
   - `email`: normalized email;
   - `createdAt`: server timestamp;
   - `passwordSalt`: random 16-byte base64url salt;
   - `passwordHash`: `scrypt` output for the server account password.
   - `recovery.verifier`: P-256 public signing key;
   - `recovery.envelope`: fixed-size PKCS#8 private-key ciphertext protected by
     the client-side master password.
5. Stores the user row in `GV_DATA_DIR/gvault-store.json`.
6. Creates and returns a bearer session token plus `userId`.

Passwords shorter than 12 characters are rejected by `hashPassword`.
New registrations without valid version-1 recovery material are rejected.
Pre-version-1 accounts remain readable and require an explicit authenticated
opt-in action before recovery becomes available.

## Account-password recovery

Evidence: `apps/server/src/auth.ts`, `apps/server/src/index.ts`,
`apps/web/public/app.js`, `apps/mobile/android/src/main/java/com/gvault/app/MobileRecoveryCrypto.java`.

`POST /api/auth/recovery/challenge` is public and always returns the same shape.
Enrolled accounts receive their master-protected envelope; unknown and
unenrolled legacy accounts receive a fixed-size, per-identifier HMAC-derived
dummy. The response contains no account-existence or enrollment flag.

The client decrypts the recovery private key locally and signs the exact
versioned challenge. `POST /api/auth/recovery/complete` consumes the challenge
before verification, validates the P-256 DER signature, hashes the new account
password with `scrypt`, atomically replaces the recovery verifier/envelope, and
returns a session. Wrong, expired, replayed, unknown, and stale-key proofs share
the generic `401 Recovery could not be completed` response. Challenge and
completion attempts have separate fixed-window limits and redacted audit events.

`POST /api/auth/recovery/setup` requires a bearer session and correct current
account password. It is the explicit opt-in path for pre-version-1 accounts and
also rotates recovery for enrolled accounts. Full primitive, message, envelope,
and reuse details are in
[account-password-recovery.md](./account-password-recovery.md).

## Password verification

Evidence: `apps/server/src/auth.ts`.

- `hashPassword` uses Node `scryptSync(password, salt, 64)` with a random
  16-byte base64url salt.
- `verifyPassword` recomputes the `scrypt` output for the supplied password and
  compares it to the stored hash with `timingSafeEqual` when lengths match.
- Stored account-password data is `passwordSalt` + `passwordHash`; plaintext
  server account passwords are not stored by the implemented server store.

This server account password is only for API authentication. It is separate from
vault encryption and cannot decrypt vault records by itself.

## Login and bearer sessions

Evidence: `apps/server/src/index.ts`, `apps/server/src/auth.ts`.

`POST /api/auth/login`:

1. Reads `email` and `password` from the JSON body.
2. Finds the stored user by normalized email.
3. Rejects missing users or wrong passwords with `401 Invalid credentials`.
4. Creates and returns a bearer session token plus `userId`.

`SessionStore.create` creates tokens as `gv_` plus 32 random bytes encoded with
base64url. Sessions are held in an in-memory `Map<string, Session>` with
`token`, `userId`, and `createdAt`.

Protected routes call `requireSession`, which accepts only an
`Authorization` header starting with `Bearer ` and looks up the token in that
in-memory session map. Missing, malformed, unknown, or expired-by-process-restart
tokens receive `401 Unauthorized`.

## Authenticated API boundary

The following routes require a valid bearer session:

- `POST /api/devices/register`
- `POST /api/auth/recovery/setup`
- `POST /api/sync/pull`
- `POST /api/sync/push`
- `POST /api/backup/export`
- `POST /api/backup/import`

The server derives the authenticated `userId` from the session, not from the
client request body. For synced records, `assertEncryptedRecord` overwrites the
incoming `ownerId` with the authenticated `userId`, so clients cannot assign
records to another account by posting a different owner id.

## Device registration boundary

`POST /api/devices/register` stores a device row with generated `dev_*` id,
authenticated `userId`, device `name`, optional `publicKey`, `createdAt`, and
`lastSeenAt`.

Current implementation note: device registration records device metadata, but it
is not a separate authentication factor and does not implement a device-token
lifecycle. Device/session token lifecycle is tracked separately in the parity
checklist.

## Current limitations

The current implementation intentionally keeps the auth model small. These are
**not** implemented here:

- Persistent server sessions across process restarts.
- Token expiry, refresh tokens, revocation, or logout endpoint.
- General login/API rate limiting, lockout, MFA, passkeys, or email verification.
- Device-bound session tokens or per-device authentication keys.
- Recovery of a forgotten master password or encrypted vault contents without it.
- Server-side access to the vault master password or plaintext vault contents.

Audit #482 tracks the session-lifecycle work in #483. Request-body limits and
rate limiting around synchronous authentication work are tracked in #485.

See [recovery-limitations.md](./recovery-limitations.md) for the lost master
password boundary and [threat-model.md](./threat-model.md) for residual risks.

## What was checked

- `apps/server/src/auth.ts` — server account password hashing, verification,
  bearer-token generation, recovery validation/proofs/challenges/limits, and
  in-memory session lookup.
- `apps/server/src/index.ts` — register/login handlers, `requireSession`,
  protected route boundary, and authenticated owner scoping.
- `apps/server/src/storage.ts` — stored user/device/session-adjacent data shapes.
