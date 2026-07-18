# Known Limitations

- The web UI keeps decrypted prototype items in memory only; encrypted persistent local cache is not implemented yet.
- The server storage layer is JSON-file based for the first clean implementation. Replace with SQLite/Postgres before multi-user production use.
- Android has a packaged preview APK with server-backed auth/vault flows and Autofill, but session tokens remain memory-only and PIN/biometric unlock are not implemented.
- Windows and Linux remain incomplete preview clients; Windows has a settings surface and login smoke path but not a full native vault workflow.
- Browser extension supports manual/session fill, generator, domain rules, and save/update prompts, but it does not yet authenticate or pull encrypted vault records from the server.
- Web settings/account management and trash/restore workflows are not implemented yet.
- Attachments are represented in the sync model but no upload/download flow is implemented yet.
- Biometric and PIN unlock require native platform work.
- No external security audit has been completed.
