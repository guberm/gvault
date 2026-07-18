# Known Limitations

- The web UI keeps decrypted prototype items in memory only; encrypted persistent local cache is not implemented yet.
- The server storage layer is a synchronous whole-file JSON rewrite with no schema validation, locking, transaction isolation, or corruption recovery. Replace or explicitly harden it before multi-user/concurrent production use (#490).
- Bearer sessions have no expiry, revocation, logout endpoint, refresh policy, or bounded retention; a server restart invalidates every session (#483).
- The unauthenticated HTTP body reader is unbounded, and synchronous `scrypt` login/register work has no rate limiting or lockout (#485).
- Android has a packaged preview APK with server-backed auth/vault flows and Autofill, but decrypted Autofill usernames, passwords, identity fields, card numbers, and security codes are persisted in ordinary SharedPreferences and reloaded after restart (#484). PIN/biometric unlock are also not implemented.
- Android accepts a shorter master password than shared/Web crypto and creates Login JSON without canonical timestamps, so cross-client policy and payload interoperability are incomplete (#486, #488).
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
