# Known Limitations

- The web UI keeps decrypted prototype items in memory only; encrypted persistent local cache is not implemented yet.
- The server JSON store now validates schema v1, serializes local writers, atomically fsyncs replacements, and keeps a validated rollback snapshot. It still blocks one Node process during whole-file mutations and is not a shared-filesystem or multi-node database; migrate to a transactional store before unbounded scale-out.
- Bearer sessions have fixed expiry, bounded retention, listing, revocation, and logout, but remain in-memory, have no refresh policy, and are not cryptographically device-bound; a server restart invalidates every session.
- JSON request bodies are bounded and synchronous authentication work has process-local account/source rate limits, but there is no distributed limiter, persistent account lockout, or multi-instance coordination.
- Android has a packaged preview APK with server-backed auth/vault flows and Keystore-encrypted, expiring Autofill cache. PIN/biometric unlock are not implemented.
- Web and Android separate regular account login from local master-password vault unlock and implement zero-knowledge account-password recovery. A forgotten master password remains unrecoverable; pre-v0.1.11 accounts must opt in explicitly before account recovery is available.
- A truly recordless new vault has no ciphertext or tombstone with which clients can authenticate a master-password candidate; there is not yet an explicit encrypted key-verification marker.
- Windows and Linux remain incomplete preview clients; Windows has a settings surface and login smoke path but not a full native vault workflow.
- Browser extension supports manual/session fill, generator, domain rules, and save/update prompts, but it does not yet authenticate or pull encrypted vault records from the server.
- Shared crypto emits a 210,000-iteration envelope while Web and Android derive with 150,000 iterations, and synced records do not carry KDF metadata needed for safe migration (#493).
- Shared sync merge can let a lower revision win when its timestamp is later instead of using the timestamp only as an equal-revision tie-breaker (#494).
- The built-in public Web/API wrapper sends a restrictive CSP and browser security headers. Custom static hosting or alternate response wrappers must preserve an equivalent policy; the CSP permits HTTPS connections so users can select a separate self-hosted server URL.
- The repository has no mandatory CI workflow; build, dependency, and cross-browser gates currently depend on operator execution (#492).
- Web settings/account management and trash/restore workflows are not implemented yet.
- Attachments are represented in the sync model but no upload/download flow is implemented yet.
- Biometric and PIN unlock require native platform work.
- No external security audit has been completed.

The complete 2026-07-17 disposition and evidence are in
[`docs/repository-audit-2026-07-17.md`](../repository-audit-2026-07-17.md).
