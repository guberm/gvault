# Known Limitations

- The web UI keeps decrypted prototype items in memory only; encrypted persistent local cache is not implemented yet.
- The server storage layer is JSON-file based for the first clean implementation. Replace with SQLite/Postgres before multi-user production use.
- Desktop and Android are architecture targets, not packaged native apps yet.
- Browser extension autofill is manual-fill prototype only and does not yet connect to the encrypted vault API.
- Attachments are represented in the sync model but no upload/download flow is implemented yet.
- Biometric and PIN unlock require native platform work.
- No external security audit has been completed.
