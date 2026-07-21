# Continuous Integration

`.github/workflows/ci.yml` runs for every pull request and every push to
`main`. Each browser and Android lane receives a clean hosted runner, its own
dependency install, process space, temporary profiles, and build output. This
prevents browser runtimes and local servers from contending with the serialized
full test gate.

## Required checks

| Required status check | Runner | Gate |
| --- | --- | --- |
| `Quality / full gate` | Ubuntu | locked install, all workspace builds, lint, serialized unit/integration tests, server smoke, high-severity dependency audit, and complete build-artifact validation |
| `Chrome extension` | Ubuntu + isolated Xvfb display | real Google Chrome MV3 load, detection, fill/save, settings, live-health smoke, and Chrome artifact validation |
| `Edge extension` | Windows | real Microsoft Edge MV3 load, detection, fill/save, settings, live-health smoke, and Edge artifact validation |
| `Firefox extension` | Ubuntu | packaged XPI installation in real headless Firefox, Autofill smoke, and Firefox artifact validation |
| `Android APK` | Windows | signed preview APK build, signature-evidence validation, and retained APK/certificate artifacts |

Branch protection on `main` requires all five exact status-check names above,
requires the branch to be current before merge, and applies to administrators.
Changing a job `name` therefore requires an atomic branch-protection update.

The full Node test command remains deterministic with
`--test-concurrency=1`. Cross-browser runtime tests are isolated in separate
jobs instead of sharing ports, browser profiles, or display processes.

## Local reproduction

Run the portable gate from the repository root:

```powershell
npm ci
npm run build
npm run lint
npm test
npm run smoke:server
npm audit --audit-level=high
node scripts/ci/check-build-artifacts.mjs
```

Run the platform lanes on hosts with the corresponding runtime installed:

```powershell
npm run smoke:chrome-extension
npm run smoke:edge-extension
npm run smoke:firefox-extension
npm run build:android
node scripts/ci/check-build-artifacts.mjs --target android
```

The hosted `Android APK` lane proves reproducible compilation, signing, and
artifact retention. It cannot replace acceptance on a physical Android device.
Any change to Android/mobile behavior must additionally install the exact APK
on an authorized device and record serial, model, Android/API version, APK hash,
installed version/signature, UI/runtime evidence, restart behavior, and crash
markers. Use `npm run e2e:android-device -- -Serial <serial>` as the baseline
device gate and add feature-specific checks where required.
