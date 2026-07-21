# Security Model

## Goals

- No plaintext vault secrets in server storage.
- No plaintext vault secrets in logs.
- Master-password derived vault encryption stays client-side.
- Server account password is separate from master password.
- Self-hosted deployment is the default path.

## Current crypto

`packages/crypto` uses:
- PBKDF2-SHA256;
- 210,000 iterations;
- AES-256-GCM;
- random 128-bit salt;
- random 96-bit nonce.

See [encryption-model.md](./encryption-model.md) for the full envelope, key
derivation, and what is and is not encrypted.

## Authentication model

Server account authentication is separate from the vault master password. See
[authentication-model.md](./authentication-model.md) for account-password hashing,
bearer sessions, authenticated route boundaries, and current limitations.

## Account-password recovery

Web and Android can reset a forgotten server account password by decrypting a
client-generated recovery signing key with the master password and signing an
expiring one-time challenge. The master password and private recovery key never
reach the server; every successful reset rotates the key. See
[account-password-recovery.md](./account-password-recovery.md) for the protocol,
enumeration resistance, recovery-specific rate limits, audit boundary, and
cross-client reuse contract.

## Not yet production complete

- Native secure storage and biometric unlock.
- Encrypted local cache in every client.
- Formal attachment encryption flow.
- Security review of browser autofill edge cases.
- Distributed authentication rate limiting, persistent account lockout, and
  multi-instance abuse coordination; the implemented fixed-window account/source
  buckets are process-local.
- Versioned cross-client KDF metadata and migration (#493).
- Production CSP and security headers (#491).

The repository-wide security/correctness disposition is recorded in
[`docs/repository-audit-2026-07-17.md`](../repository-audit-2026-07-17.md).

## Threat model

See [threat-model.md](./threat-model.md) for assets, trust boundaries, actors,
threats/mitigations, and residual risks for the current implementation.

## Recovery limitations

A lost master password cannot be recovered or reset; encrypted vault records
become permanently undecryptable. See
[recovery-limitations.md](./recovery-limitations.md) for what can and cannot be
recovered.
