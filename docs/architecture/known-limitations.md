# Known Limitations

- The web UI keeps decrypted prototype items in memory only; encrypted persistent local cache is not implemented yet.
- The server storage layer is a synchronous whole-file JSON rewrite with no schema validation, locking, transaction isolation, or corruption recovery. Replace or explicitly harden it before multi-user/concurrent production use (#490).
- Bearer sessions have fixed expiry, bounded retention, listing, revocation, and logout, but remain in-memory, have no refresh policy, and are not cryptographically device-bound; a server restart invalidates every session.
- The unauthenticated HTTP body reader is unbounded, and synchronous `scrypt` login/register work has no rate limiting or lockout (#485).
- Android has a packaged preview APK with server-backed auth/vault flows and Keystore-encrypted, expiring Autofill cache. PIN/biometric unlock are not implemented.
- Web and Android separate regular account login from local master-password vault unlock and implement zero-knowledge account-password recovery. A forgotten master password remains unrecoverable; pre-v0.1.11 accounts must opt in explicitly before account recovery is available.
- A truly recordless new vault has no ciphertext or tombstone with which clients can authenticate a master-password candidate; there is not yet an explicit encrypted key-verification marker.
- Windows and Linux remain incomplete preview clients; Windows has a settings surface and login smoke path but not a full native vault workflow.
- Browser extension supports manual/session fill, generator, domain rules, and save/update prompts, but it does not yet authenticate or pull encrypted vault records from the server.
- Shared URL matching accepts lookalike sibling domains because it uses suffix matching without a dot boundary (#489).
- Shared crypto emits a 210,000-iteration envelope while Web and Android derive with 150,000 iterations, and synced records do not carry KDF metadata needed for safe migration (#493).
- Shared sync merge can let a lower revision win when its timestamp is later instead of using the timestamp only as an equal-revision tie-breaker (#494).
- The public Web response does not yet provide a restrictive CSP, HSTS, `nosniff`, Referrer-Policy, or Permissions-Policy (#491).
- The repository has no mandatory CI workflow; build, dependency, and cross-browser gates currently depend on operator execution (#492).
- Web settings/account management and trash/restore workflows are not implemented yet.
- Attachments are represented in the sync model but no upload/download flow is implemented yet.
- Biometric and PIN unlock require native platform work.
- No external security audit has been completed.

The complete 2026-07-17 disposition and evidence are in
[`docs/repository-audit-2026-07-17.md`](../repository-audit-2026-07-17.md).
