# GVault Desktop

Desktop packaging target for Windows and Linux. The first release keeps desktop as an architecture package that wraps the shared web vault UI and shared core packages.

Planned runtime: Tauri first, Electron if browser-extension bridge requirements need Chromium APIs.

Security requirements:
- store server session tokens in the OS keychain;
- keep the master key in memory only while unlocked;
- support auto-lock and clipboard timeout;
- never log decrypted vault fields.
