# TwoFAS Repository Assessment

Assessment date: 2026-07-03.

Primary source inspected: `https://github.com/twofas` through GitHub API and repository README/LICENSE files.

## Repositories inspected

| Repository | License observed | Fit | Decision |
| --- | --- | --- | --- |
| `twofas/2fas-pass-server` | Business Source License 1.1 | Password-manager bridge server, zero-knowledge WebSocket-oriented design | Rejected for code reuse; used as architecture reference only |
| `twofas/2fas-pass-browser-extension` | Business Source License 1.1 | Browser extension for password access and security tiers | Rejected for code reuse; used as architecture reference only |
| `twofas/2fas-pass-android` | Business Source License 1.1 | Android password-manager client | Rejected for code reuse; used as architecture reference only |
| `twofas/2fas-pass-ios` | Business Source License 1.1 | iOS password-manager client | Rejected for code reuse; used as architecture reference only |
| `twofas/2fas-server` | GPL-3.0 | OTP/auth server, not a password vault backend | Rejected; wrong product domain |
| `twofas/2fas-browser-extension` | GPL-3.0 | OTP browser extension | Rejected; wrong product domain |
| `twofas/2fas-share` | GPL-3.0 | E2EE one-time text sharing | Rejected for core reuse; useful security reference |

## Summary

TwoFAS Pass is conceptually relevant, but its BUSL 1.1 license is not a clean fit for a new open-source password manager monorepo. GVault therefore uses a clean-room implementation and preserves attribution in this assessment document without copying TwoFAS source code.

Reusable ideas:
- local-first vault boundary;
- zero-knowledge server;
- user-controlled sync;
- browser extension bridge;
- security tiers concept for future item permissions.

Rejected:
- source-code reuse from BUSL repositories;
- OTP Auth repositories as a password-manager base;
- mandatory proprietary/cloud sync patterns.
