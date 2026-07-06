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

## Not yet production complete

- Native secure storage and biometric unlock.
- Encrypted local cache in every client.
- Formal attachment encryption flow.
- Security review of browser autofill edge cases.
- Rate limiting and account lockout on the server.

## Threat model

See [threat-model.md](./threat-model.md) for assets, trust boundaries, actors,
threats/mitigations, and residual risks for the current implementation.

## Recovery limitations

A lost master password cannot be recovered or reset; encrypted vault records
become permanently undecryptable. See
[recovery-limitations.md](./recovery-limitations.md) for what can and cannot be
recovered.
