# GVault RoboForm Parity Proof/E2E Report

Target public service: `https://gvault.guber.dev`
Parent issue: [#35](https://github.com/guberm/gvault/issues/35)
Checklist source: [`docs/roboform-parity-checklist.md`](./roboform-parity-checklist.md)
Issue index: [`docs/roboform-parity-issue-index.md`](./roboform-parity-issue-index.md)

This report is the final Proof/E2E checkpoint for the current RoboForm parity proof pass. It separates:

- **Passed** — evidence-backed checks that have a merged PR, closed issue, and concrete build/run/device/browser proof.
- **Partial** — useful smoke or platform evidence that does not imply full RoboForm parity for that surface.
- **Blocked / not yet verified** — broader product or operations coverage that remains outside the completed Proof/E2E items.

## Passed Proof/E2E checks

| Issue | Surface | Evidence summary | Merge / proof |
|---|---|---|---|
| [#398](https://github.com/guberm/gvault/issues/398) | Web E2E through `https://gvault.guber.dev` | `npm run smoke:web` exercises live web registration, unlock, login-item creation, sync, reload, login, sync-back/search, and mobile-width rendering. `npm run check` also passed. Live `/` served `#serverUrl=https://gvault.guber.dev`; `/healthz` returned `ok:true`, `product:"GVault"`. | [PR #420](https://github.com/guberm/gvault/pull/420), `6a7b2d3b5345d063266911fb800b2dc079aae06d` |
| [#399](https://github.com/guberm/gvault/issues/399) | Android real-device E2E through `https://gvault.guber.dev` | Physical Pixel 7 Pro proof via Windows ADB: app sign-in through the live service, Autofill disabled guidance, Android preferred-service picker, GVault Autofill selection/confirmation, secure `autofill_service` set to `com.gvault.app/com.gvault.app.GVaultAutofillService`, and final enabled-copy proof. | [Parent evidence comment](https://github.com/guberm/gvault/issues/35#issuecomment-4887280101) |
| [#400](https://github.com/guberm/gvault/issues/400) | Chrome extension E2E | `DISPLAY=:0 npm run smoke:chrome-extension` passed with real Google Chrome. The test loaded the unpacked MV3 Chrome build, filled a login form, opened the popup, saved `https://gvault.guber.dev`, and fetched `/healthz` from the extension page. `npm run check` passed. | [PR #419](https://github.com/guberm/gvault/pull/419), `5da8f30f023972dc63a70534986a6986f08c6ccd` |
| [#401](https://github.com/guberm/gvault/issues/401) | Edge extension E2E | Windows host `NAV-PF4MHFP3` ran `npm ci --no-audit --no-fund && npm run smoke:edge-extension`; TAP reported `ok 1 - Edge extension loads and fills a login form in Microsoft Edge`. Linux/control-plane `npm run check` passed. | [PR #418](https://github.com/guberm/gvault/pull/418), `687ac24828a21c148e9952fbf33c24d995c3e292` |
| [#402](https://github.com/guberm/gvault/issues/402) | Windows desktop login smoke | Added Windows `GVault.exe --login-smoke` and `npm run smoke:windows-client`. Local `npm run check` passed; Windows host proof passed from clean archived branch source; live Windows smoke passed against `https://gvault.guber.dev`. | [PR #416](https://github.com/guberm/gvault/pull/416), `9a81a3dd833437e72d22bcacb577ab8bdf5b4a71` |
| [#403](https://github.com/guberm/gvault/issues/403) | Linux client login smoke | Added Linux `GVault --login-smoke` and `npm run smoke:linux-client`. Local `npm run check` and `npm run smoke:linux-client` passed; live verification passed against `https://gvault.guber.dev`. | [PR #415](https://github.com/guberm/gvault/pull/415), `2b61533485d92f7f511698d16d09bd866371da37` |
| [#404](https://github.com/guberm/gvault/issues/404) | Server integration tests | `npm run check` passed with expanded server smoke coverage for health, register/login success, bad-login rejection, protected endpoint `401`, sync push, backup export/import, and unknown-route `404`. | [PR #414](https://github.com/guberm/gvault/pull/414), `c8d5289c51a4468173c59b24d322881204a76c35` |
| [#405](https://github.com/guberm/gvault/issues/405) | Import/export tests | Server smoke exports a backup, imports it into a separate account, and verifies the encrypted record is retrievable under the importing user. Existing core tests cover RoboForm CSV, generic CSV, Bitwarden CSV, and 1Password CSV mappings. Verified commands included `npm run build`, `npm run smoke:server`, `npm test -- tests/core.test.mjs`, and `git diff --check`. | [PR #413](https://github.com/guberm/gvault/pull/413), `d3bcc345a4b14c5e3f01c2adf235d65c64b49138` |
| [#406](https://github.com/guberm/gvault/issues/406) | Autofill tests where feasible | `npm test -- tests/android-autofill-*.test.mjs` passed. Coverage includes payment-card entries, identity/address entries, blank-placeholder suppression, setup guidance/active-service detection, and server-backed Login cache/matching. Real-device picker/selection evidence was also covered by #399. | [PR #412](https://github.com/guberm/gvault/pull/412), `16064761823fad5a4e8713c21eca460b4001f320` |

## Partial / limited proof

These checks are useful evidence, but they should not be read as full RoboForm parity for the whole product surface:

- **Web:** #398 proves live public web smoke coverage for account/session/vault-sync basics. The broader checklist still has unchecked web UX items such as repeated existing-user login after clean reload, logout/reload behavior, auth error/loading states, copy/reveal UX, full item-type creation, trash/restore, folders/tags, and deeper settings/account polish.
- **Android:** #399 and #406 prove real-device login/autofill paths and Autofill-oriented tests. Audit #482 later reopened #118 because decrypted Autofill values survive app/process restart in ordinary SharedPreferences (#484); the earlier functional proof must not be read as restart/lock security proof.
- **Browser extensions:** #400 and #401 prove Chrome/Edge extension load/fill smoke paths. The broader extension checklist still has unchecked production-client work such as popup login/register, server-backed vault pull, current-domain suggestions, save/update prompts, context menus, per-site rules, and multiple-credential UX.
- **Windows desktop:** #402 proves a Windows login smoke path, including live-service verification. It does not prove a full desktop vault GUI/client; the wider checklist still tracks vault list/detail/editor, tray UX, settings/preferences, search, copy/reveal, and create/edit/delete behavior.
- **Linux client:** #403 proves a Linux login smoke path, including live-service verification. It does not prove a full Linux CLI/GUI vault client; the wider checklist still tracks CLI/GUI product decisions and list/get/create/edit/delete behavior.
- **Server/import/export:** #404 and #405 prove key integration and backup import/export paths. They are not a full security audit, deployment durability proof, or exhaustive storage/recovery validation.

## Blocked / not yet verified

The current Proof/E2E section is complete, but the product-level parity checklist still contains work that is explicitly not proven by these smoke checks:

- **Operations persistence:** managed server/Web service, controlled service restart, production data directory, and unauthenticated health are now verified (#41, #42, #44, #47, #49). File-backed route reconciliation, host reboot survival, TLS renewal, and the backup/restore runbook remain unchecked.
- **Full cross-client parity:** extension, Windows, and Linux clients still have unchecked server-backed vault UI/functionality beyond login/fill smoke coverage.
- **Full vault taxonomy:** many RoboForm-like item types and editors remain unchecked, including bookmarks, applications, contacts, bank accounts, passports/documents, business profiles, vehicle profiles, folders/collections, tags, and TOTP/authenticator items.
- **Advanced security and recovery:** sharing, emergency access/recovery, security center/audit features, advanced policies, and complete sensitive-field protections are outside the completed Proof/E2E issue set unless separately checked in the main checklist.
- **Deployment durability:** `https://gvault.guber.dev` is the verified target and controlled service restart now has evidence. This report still does not claim host-reboot or TLS-renewal proof.

## Current conclusion

For parent issue [#35](https://github.com/guberm/gvault/issues/35), every granular Proof/E2E task [#398](https://github.com/guberm/gvault/issues/398) through [#406](https://github.com/guberm/gvault/issues/406) is closed as completed with evidence. The final report task [#407](https://github.com/guberm/gvault/issues/407) is satisfied by this document once it is merged and the parent/checklist/index entries are updated.

The accurate product status is:

- **Passed:** Proof/E2E smoke coverage for live web, Android real-device Autofill, Chrome/Edge extensions, Windows/Linux login smoke, server integration, import/export, and feasible Autofill tests.
- **Partial:** these proofs validate specific flows, not complete RoboForm product parity for every client and feature.
- **Blocked / not yet verified:** remaining deployment durability (host reboot/TLS/backup), full cross-client vault UX, complete item taxonomy, and advanced security/recovery features remain tracked in the broader checklist.
