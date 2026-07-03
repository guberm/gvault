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
