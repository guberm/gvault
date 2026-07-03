# GVault Android

Android client target for the GVault vault.

Initial architecture:
- native Android shell;
- shared vault model and sync protocol from `packages/`;
- Android Keystore for wrapped local unlock keys;
- biometric/PIN quick unlock guarded by OS secure hardware where available;
- offline-first encrypted local cache;
- self-hosted sync API only.
