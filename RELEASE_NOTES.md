# GVault 0.1.14

Public API error-boundary hotfix.

Changed:
- the production Web/API wrapper now uses the same bounded API error handler as the standalone server;
- malformed and oversized JSON requests return `400`/`413` without terminating the managed public process;
- integration coverage verifies both responses and a healthy follow-up request through `scripts/dev/serve-public.mjs`.

Validation:
- strict RED/GREEN reproduction of the production `ECONNRESET` and service crash;
- full repository gate and independent Reviewer approval;
- exact-commit production deployment and public acceptance for `400`, declared/chunked `413`, account `429`, isolated normal login, sanitized proxy source, service stability, and the v0.1.14 marker.

# GVault 0.1.13

API authentication abuse-controls release.

Changed:
- every JSON API route now rejects malformed bodies with `400` and declared or streamed bodies above the configurable 1 MiB default with `413`;
- registration, login, and authenticated recovery setup now share independent per-account and per-source fixed-window limits before synchronous `scrypt` work, with bounded key maps;
- recovery-specific limits use the same request-source boundary, and limited auth audit events contain only hashed identifiers;
- forwarded client addresses are ignored unless `GV_TRUST_PROXY=true`; the nginx example overwrites `X-Forwarded-For` and documents the sole-ingress trust requirement;
- self-hosted environment, Compose, security, threat-model, audit, and parity documentation now describe the production settings and process-local residual risk.

Validation:
- strict RED/GREEN integration coverage for declared and chunked body limits, malformed JSON, account/source isolation, trusted-proxy behavior, registration, login, and recovery setup;
- full repository gate and independent Reviewer approval; live malformed-body acceptance subsequently exposed the public-wrapper error boundary fixed in v0.1.14.

# GVault 0.1.12

Bounded server-session lifecycle release.

Changed:
- bearer sessions now have a fixed 24-hour expiry, safe public session ids, device labels, last-seen metadata, and prune-on-use behavior;
- the in-memory store retains only the newest 10 sessions per user and 10,000 sessions per process, with environment overrides for all three limits;
- authenticated APIs now list safe session metadata, revoke an owned session, and log out the current session without exposing bearer tokens;
- Web and Android Sign out now revoke the server token, identify their device when creating sessions, and clear local secret state on expired/revoked-token responses;
- the shared TypeScript API client and Windows/Linux login smoke clients follow the same session contract;
- the browser extension remains sessionless until its server-account flow is implemented.

Validation:
- strict RED/GREEN coverage for expiry boundaries, per-user/global capacity, cross-user revoke isolation, logout, revoked/expired bearer rejection, API-client token clearing, and Web/Android client behavior;
- full repository gate, independent Reviewer approval, production Web lifecycle acceptance, and physical Pixel 7 Pro Android logout/revocation acceptance.

# GVault 0.1.11

Zero-knowledge account-password recovery release.

Changed:
- Web and Android account creation now generate a P-256 recovery signing key client-side and store it only in a fixed-size AES-256-GCM envelope protected by the master password;
- the server stores only the public recovery verifier and encrypted envelope—never the master password, private recovery key, or a reusable master-password verifier;
- forgotten server account passwords can be reset from Web and Android by signing an expiring one-time challenge, followed by mandatory recovery-key rotation;
- unknown, unenrolled, wrong-master, expired, replayed, and stale-key attempts use enumeration-resistant public responses and generic failures;
- recovery challenge and completion paths have separate fixed-window limits and secret-free audit events;
- pre-v0.1.11 accounts remain unchanged until the user explicitly enables recovery while authenticated and locally unlocked;
- browser-extension, Windows, and Linux clients have a documented versioned reuse contract for future account flows.

Security boundary:
- this recovers only the server account password;
- a forgotten master password remains unrecoverable and encrypted vault data cannot be decrypted without it;
- recovery does not yet revoke existing bearer sessions; session lifecycle remains tracked by #483.

Validation:
- protocol, replay, rotation, enumeration, rate-limit, audit-redaction, Web UI, and Android crypto tests;
- full repository build/lint/test/server-smoke gate;
- independent Reviewer approval;
- production Web recovery acceptance and exact release-asset physical Pixel 7 Pro acceptance.

# GVault 0.1.10

Account and vault-password separation release.

Changed:
- regular Web and Android login now uses only email and the server account password;
- account creation requires a confirmed master password without sending it to the server;
- vault unlock/restoration is a separate client-side step after account login;
- Web and Android authenticate restore candidates against all encrypted records, including deleted tombstones, before exposing decrypted state or enabling Autofill;
- Web restore is pull-only, preventing ciphertext from being written under an unverified candidate key;
- documented the same authentication contract for browser-extension and desktop clients when those surfaces gain account flows;
- retained secure account-password recovery as follow-up #501 instead of weakening the zero-knowledge boundary.

Validation:
- full repository gate passed 138/138 tests plus server smoke 1/1;
- independent Reviewer approval obtained after the authenticated-restore findings were fixed;
- Android APK built and passed physical-device registration, regular login, wrong/correct master restore, encrypted Autofill, tombstone-only verification, and crash-buffer acceptance on Pixel 7 Pro `29221FDH300MLF` (Android 17/API 37).

# GVault 0.1.9

Android security and compatibility hotfix.

Changed:
- encrypted the Android Autofill cache with Android Keystore AES-GCM;
- added an explicit 15-minute Autofill unlock grant and restart/sign-out/expiry cleanup;
- enforced the shared 12-character master-password minimum on Android;
- emitted canonical Android Login timestamps and fields with monotonic updates.

Validation:
- all 10 Android-focused tests passed;
- signed APK built and installed on Pixel 7 Pro `29221FDH300MLF`;
- physical-device restart/sign-out Autofill isolation, 11/12-character boundary,
  canonical live record validation, locked startup, and empty crash buffer passed;
- PR #498 received independent Reviewer approval after its timestamp finding was fixed.

# GVault 0.1.8

Web vault reference-alignment release.

Changed:
- rebuilt the web vault dashboard to match the provided reference layout more closely;
- switched the web vault to a light sidebar, top server/account/sync bar, item list pane, detail panel, generator card, edit form, create card, and bottom health strip;
- kept existing unlock, item creation, password generation, sync, and theme toggle flows working against the new layout.

Validation:
- `npm run e2e:all -- -AndroidSerial 29221FDH300MLF` passed on Windows;
- rendered web dashboard screenshot checked against the provided reference;
- Docker runtime smoke skipped because Docker CLI is not installed on this machine.

# GVault 0.1.7

Light and dark mode release.

Added:
- light/dark mode switch in the web vault;
- light/dark mode switch in the admin client;
- light/dark mode switch in Chrome, Firefox, and Edge extension popup/options;
- light/dark mode switch in the Windows desktop client;
- light/dark mode switch in the Android client;
- e2e assertions for web, browser extension, and Android theme controls.

Validation:
- `npm run e2e:all -- -AndroidSerial 29221FDH300MLF` passed on Windows;
- Docker runtime smoke skipped because Docker CLI is not installed on this machine.

# GVault 0.1.6

Autofill service release.

Added:
- Android `AutofillService` registration with login-field detection and a GVault dataset entry;
- browser extension service-worker autofill routing for active-tab fill and session-only per-site autofill;
- Android device e2e assertion that the autofill service is registered in the installed APK.

Validation:
- `npm run e2e:all -- -AndroidSerial 29221FDH300MLF` passed on Windows;
- Docker runtime smoke skipped because Docker CLI is not installed on this machine.

# GVault 0.1.5

Client UI hardening and all-platform validation release.

Added:
- end-user web vault shell with lock/unlock, server connection, search, category counts, item list, detail panel, multi-type item editor, password generator, and encrypted sync status;
- browser extension popup UI for manual autofill, detected-form status, and saved self-hosted server URL;
- Windows desktop client shell with web vault/server entry points and native client status;
- Android client onboarding/status UI with server, vault, security, and web vault action;
- e2e coverage for web vault creation/sync, Chrome extension, Edge extension, Windows EXE launch, Linux WSL binary launch, Firefox extension lint, and physical Android device UI.

Validation:
- `npm run e2e:all -- -AndroidSerial 29221FDH300MLF` passed on Windows;
- APK built and installed on Android device `29221FDH300MLF`;
- Docker runtime smoke was skipped because Docker CLI is not installed on this machine.

# GVault 0.1.1

Platform artifact release.

Added:
- Android APK build target and signed preview APK;
- Windows x64 desktop EXE build target;
- reproducible PowerShell build scripts for APK and EXE artifacts.

Validation:
- Android APK verified with `aapt dump badging` and `apksigner verify`;
- Windows EXE published with `dotnet publish`;
- full `npm run check` passed.

# GVault 0.1.0

Initial clean-room monorepo release.

Highlights:
- self-hosted server with account auth, device registration, encrypted record sync, backup/export, and health endpoint;
- shared vault model for logins, notes, identities, payment cards, addresses, and custom items;
- shared crypto, sync, core, API client, and UI packages;
- web vault UI with unlock state, search, login creation, password generation, and server connection controls;
- browser extension packages for Chrome, Firefox, and Edge with form detection and manual fill prototype;
- desktop and Android architecture targets;
- Docker Compose, reverse proxy example, deployment docs, security docs, and tests.
