# GVault

GVault is a clean-room, self-hosted password manager and identity vault monorepo.

The project is inspired by the user value of RoboForm-like password, identity, card, address, autofill, generator, and sync flows. It does not copy RoboForm code, branding, UI, assets, or proprietary implementation.

## Apps

- `apps/server` - self-hosted Node API for accounts, devices, encrypted sync records, backup/export, health.
- `apps/web` - browser vault UI with onboarding, lock/unlock state, search, login creation, generator, and server connection controls.
- `apps/admin` - deployment health UI.
- `apps/browser-extension` - Chrome, Firefox, and Edge MV3 extension package for form detection and manual fill.
- `apps/desktop` - Windows/Linux desktop architecture target.
- `apps/mobile` - Android architecture target.

## Packages

- `packages/vault-models` - shared vault item schema.
- `packages/crypto` - client-side PBKDF2/AES-GCM envelope helpers.
- `packages/core` - vault search, URL matching, generator, strength estimate.
- `packages/sync` - encrypted record sync merge/conflict helpers.
- `packages/api-client` - self-hosted API client.
- `packages/ui` - brand constants and shared base styles.
- `packages/shared-utils` - shared utility functions.

## Development

```bash
npm install
npm run build
npm test
npm run smoke:server
```

## Platform artifacts

```bash
npm run build:android
npm run build:windows
```

Outputs:
- `apps/mobile/dist/gvault-android-v<version>.apk`
- `apps/desktop/dist/windows-x64/GVault.exe`

Android preview builds use the checked-in debug keystore. Production signing uses environment variables; see `docs/deployment/android-signing.md`.

## Self-hosted server

```bash
cp .env.example .env
npm run build -w @gvault/server
npm start -w @gvault/server
```

The server stores encrypted vault records only. Master-password based encryption is client-side.

## Docker Compose

```bash
docker compose -f infra/compose/compose.yaml up --build
```

## Security status

This is an initial review-ready implementation, not a production-audited password manager. See `docs/security/security-model.md` and `docs/architecture/known-limitations.md`.
