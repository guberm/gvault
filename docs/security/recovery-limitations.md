# Recovery Limitations

Scope: the current GVault implementation in this repository. This document is
repo-grounded and intentionally does **not** describe recovery features that are
not implemented. It states honestly what can and cannot be recovered today.

## Summary

GVault is master-password encrypted client-side. The master password derives the
vault key (`packages/crypto/src/index.ts`: PBKDF2-SHA256, 210,000 iterations,
AES-256-GCM). The master password is never sent to or stored by the server
(`apps/server/src/index.ts`, `docs/security/security-model.md`). As a direct
consequence:

- **A lost or forgotten master password cannot be recovered or reset.** There is
  no server-side copy, no recovery key, and no backdoor. Encrypted vault records
  become permanently undecryptable.
- **The server operator cannot decrypt vault contents** to help a user recover.
  The server only ever holds encrypted blobs.

This is the intended zero-knowledge property, not a defect. It is also a hard
limit that users must understand before relying on GVault.

## What is NOT implemented

The following recovery/reset mechanisms do **not** exist in this repository. Do
not assume any of them are available:

- Master-password reset or "forgot master password" flow.
- Account recovery key / paper key / recovery code.
- Emergency access (trusted contact) workflow.
- Key escrow or operator-side key recovery.
- Server-side re-encryption of vault records without the master password.

## What CAN be recovered

- **Server account password** (separate from the master password) is verified by
  a server-side `scrypt` hash (`apps/server/src/auth.ts`). It authenticates to
  the API only; recovering or changing it does **not** grant access to encrypted
  vault contents without the master password.
- **Encrypted vault records** can be restored from a backup export/import
  (`apps/server/src/index.ts`), but the restored records are still encrypted
  under the original master password. Restoring a backup does not bypass the
  master-password requirement.

## User guidance

- Store the master password where it cannot be lost (e.g. a securely kept written
  copy or a separate trusted password manager).
- Losing the master password means losing the vault. There is no support path
  that can recover it.

## Related documents

- [security-model.md](./security-model.md) — encryption model and scope.
- [threat-model.md](./threat-model.md) — assets, trust boundaries, and residual risks.
