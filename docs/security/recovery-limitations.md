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

- **Server account password** can be reset on enrolled accounts in Web and
  Android. The client uses the master password to decrypt a recovery signing key
  locally, proves possession with a one-time challenge, chooses a new account
  password, and rotates the recovery key. The server stores only the public
  verifier and encrypted key envelope; it never receives the master password or
  private recovery key. See
  [account-password-recovery.md](./account-password-recovery.md).
- **Encrypted vault records** can be restored from a backup export/import
  (`apps/server/src/index.ts`), but the restored records are still encrypted
  under the original master password. Restoring a backup does not bypass the
  master-password requirement.
- **A regular account login** uses email and the server account password only.
  After login, Web and Android request the master password separately when the
  encrypted vault must be unlocked/restored on that device. This local restore
  step does not reset a forgotten server account password.

## User guidance

- Store the master password where it cannot be lost (e.g. a securely kept written
  copy or a separate trusted password manager).
- Losing the master password means losing the vault and also makes the
  master-protected account recovery key unusable. There is no operator support
  path that can recover either.

## Android Autofill cache lifecycle

Android Autofill data is a temporary convenience cache, not a recovery source.
After successful authentication the app grants Autofill access for at most 15
minutes and stores the cache as Android Keystore AES-GCM ciphertext. App/process
restart, explicit sign-out, expiry, or a cache-decryption failure clears access;
legacy plaintext Autofill preference values are removed. Once cleared, the cache
cannot restore credentials: the user must authenticate and decrypt the
server-backed vault again.

This behavior was accepted on a physical Pixel 7 Pro against
`https://gvault.guber.dev`: Autofill offered the matching Login while unlocked,
then returned zero entries after force-stop/relaunch and after explicit sign-out.

## Related documents

- [security-model.md](./security-model.md) — encryption model and scope.
- [threat-model.md](./threat-model.md) — assets, trust boundaries, and residual risks.
- [account-password-recovery.md](./account-password-recovery.md) — implemented
  account-password recovery protocol and its limits.
