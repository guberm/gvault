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
