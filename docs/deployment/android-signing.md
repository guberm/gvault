# Android Signing

GVault includes `apps/mobile/android/gvault-debug.keystore` for repeatable preview APK builds. It is a public debug key, not a production release key.

For production signing, keep the keystore outside the repository and set:

```powershell
$env:GV_ANDROID_KEYSTORE = "C:\secure\gvault-release.keystore"
$env:GV_ANDROID_KEYSTORE_PASSWORD = "..."
$env:GV_ANDROID_KEY_PASSWORD = "..."
$env:GV_ANDROID_KEY_ALIAS = "gvault-release"
npm run build:android
```

Never commit a production Android signing key or its passwords.
