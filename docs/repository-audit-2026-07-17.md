# GVault Repository Audit — 2026-07-17

Tracking issue: [#482](https://github.com/guberm/gvault/issues/482)

Base audited: `fc6dd82` (merged PR #481)

Target service: `https://gvault.guber.dev`

## Scope and method

This audit reconciled the repository, public runtime, GitHub issue state, and the
RoboForm-derived primary requirements. The inventory covered 72 production,
build, and deployment paths (6,770 nonblank implementation/configuration lines at
the audit snapshot), then separately reviewed tests and primary documentation.

The review included:

- Web UI/auth/sync/item editing and responsive behavior;
- Android auth, encrypted-record handling, vault UI, Autofill, build/signing,
  and process/restart boundaries;
- Chrome, Edge, and Firefox extension manifests, service worker, content script,
  popup/options UI, fill/save/generator/domain behavior, and packaging;
- server HTTP parsing, authentication/sessions, encrypted sync, backup/import,
  JSON persistence, CORS, and health handling;
- shared vault models, crypto, sync, URL matching, API client, UI utilities, and
  password generation/import parsers;
- Windows/Linux preview clients, build scripts, release scripts, container and
  reverse-proxy configuration;
- automated tests, dependency/static checks, deployment state, closed issues,
  parent checklists, and requirements documentation.

This is a source/runtime audit, not an external penetration-test certification.

## Confirmed findings and disposition

| Issue | Finding | Audit disposition |
| --- | --- | --- |
| [#483](https://github.com/guberm/gvault/issues/483) | Server bearer sessions have no expiry, revocation, logout, or bounded lifecycle. | Fixed in v0.1.12: fixed expiry, bounded retention, safe listing/revocation/logout, live Web proof, and physical Android acceptance. |
| [#484](https://github.com/guberm/gvault/issues/484) | Android Autofill persists decrypted secrets in ordinary SharedPreferences and reloads them after restart. | Fixed: Keystore AES-GCM cache, explicit 15-minute unlock grant, legacy cleanup, and Pixel 7 Pro restart/sign-out proof. |
| [#485](https://github.com/guberm/gvault/issues/485) | Request bodies are unbounded and unauthenticated synchronous `scrypt` work is not rate-limited. | Fixed across v0.1.13/v0.1.14: declared/streamed JSON bounds, stable public `400/413` errors, pre-scrypt account/source limits, explicit trusted-proxy mode, production configuration, integration coverage, and live `429` isolation proof. |
| [#486](https://github.com/guberm/gvault/issues/486) | Android accepts master passwords below the shared/Web 12-character minimum. | Fixed: Android auth and crypto enforce 12 characters; Pixel 7 Pro rejected 11 characters with actionable copy and accepted 12. |
| [#487](https://github.com/guberm/gvault/issues/487) | Blank Web account password became the fixed `change-me-strong-password` credential. | Closed after strict browser TDD, PRs #495/#496, deploy, and live acceptance at `43eb1b8`. |
| [#488](https://github.com/guberm/gvault/issues/488) | Android Login JSON omits canonical `createdAt`/`updatedAt` fields. | Fixed: create/edit preserve canonical timestamps and fields; a physical-device-created record passed the shared `isVaultItem` validator after live pull/decryption. |
| [#489](https://github.com/guberm/gvault/issues/489) | Shared URL matching accepts lookalike sibling domains. | Fixed in v0.1.15: exact and dot-delimited subdomains match, while sibling and parent-suffix lookalikes are rejected; all callers were audited and the independent extension matcher passed compatibility acceptance. |
| [#490](https://github.com/guberm/gvault/issues/490) | JSON storage lacks transactional concurrency, validation, and recovery guarantees. | Open. |
| [#491](https://github.com/guberm/gvault/issues/491) | Live Web lacks CSP and the expected browser security headers. | Open; verified against the public response. |
| [#492](https://github.com/guberm/gvault/issues/492) | No mandatory CI/cross-browser workflow exists, and parallel browser files contend for runtime resources. | Open; the local full test gate is serialized by this audit fix, but mandatory CI/platform lanes remain. |
| [#493](https://github.com/guberm/gvault/issues/493) | Shared crypto uses 210,000 PBKDF2 iterations while Web/Android use 150,000, with no KDF metadata in synced records. | Open; runtime cross-client decryption proof failed as expected. |
| [#494](https://github.com/guberm/gvault/issues/494) | A lower sync revision can override a higher revision when its timestamp is later. | Open; runtime revision 9 vs. 10 proof confirmed. |

No confirmed finding was left only in prose: each has a granular issue and
acceptance criteria.

## Closed-issue and requirements reconciliation

- #41, #42, #44, #47, and #49 were revalidated against the live host and are now
  checked in parent #1 plus the checklist/index.
- #118 was reopened because its functional restart claim hid a decrypted-secret
  persistence boundary; the Android remediation now defines and verifies locked
  restart behavior, so #118 and the corresponding parent #6 checklist item can
  be completed after merge.
- Parent #29 now reflects completed format parsers #341–#344.
- #346, #347, #351, #352, and #392 received code-path evidence explaining why
  duplicate, validation, restore, and backup-security work remains open.

## Runtime and test evidence collected during the audit

- Strict RED→GREEN browser coverage proves a blank/whitespace account password
  emits zero register requests and shows the exact warning
  `Account password is required.`
- The serialized full `npm run check` gate passed 133/133 tests, followed by
  server smoke 1/1; the prior parallel run reproduced the browser contention
  now documented in #492.
- A packaged Firefox XPI was temporarily installed in real Mozilla Firefox; the
  MV3 runtime loaded and Firefox storage → background → content-script Autofill
  filled only the intended credential fields. The test passed 1/1 and left no
  Firefox/geckodriver processes.
- Real Google Chrome and Microsoft Edge extension smoke runs each passed 1/1.
- Firefox `web-ext lint` reported zero errors, notices, or warnings.
- `npm audit --audit-level=low` reported zero known dependency vulnerabilities.
- Windows and Linux .NET builds completed with zero warnings and zero errors.
- Static secret-pattern scanning found no credential/token matches.
- A machine comparison of the issue index against all 421 GitHub issues found
  zero OPEN/CLOSED marker mismatches; stale parent bodies #1, #6, #7, #12, and
  #29 were reconciled.
- The controlled `gvault-public.service` restart returned healthy local and
  public `/healthz` responses; the store remained in
  `/home/mg/.local/share/gvault-data` with mode `0600`.
- Docker validation could not run because Docker CLI is not installed on the
  Windows dev station; compose/container files were reviewed statically.

The original audit checkpoint had no connected Android device. The follow-up was
completed with a physical Pixel 7 Pro (`29221FDH300MLF`, Android 17/API 37) and a
signed non-debuggable `0.1.8` APK against `https://gvault.guber.dev`:

- an 11-character master password was rejected with
  `Master password must be at least 12 characters.`, while 12 characters opened
  the newly registered live account;
- Android created `Pixel_Canonical_Login`; after live pull and Windows-side
  decryption, the shared `isVaultItem` validator accepted it with valid
  `createdAt`, `updatedAt`, and `urls` fields;
- while unlocked, Chrome received the matching Login Autofill dataset; after
  force-stop/relaunch and after explicit sign-out, GVault returned to the locked
  account screen and subsequent fill requests reported zero entries;
- the Android crash buffer remained empty throughout acceptance.

## Final merged live acceptance

Production was updated to merge commit `43eb1b8` and
`gvault-public.service` restarted successfully. Final evidence:

- local and public `/healthz` returned `ok: true`, product `GVault`;
- the public browser loaded `./app.js?v=487` from
  `https://gvault.guber.dev/app.js?v=487`;
- public `app.js` SHA-256
  `756025cfd0a6be3903576913c9b2dc63783b11b7ae2c576d19110e64d35dc5b5`
  exactly matched the server build;
- a real headless Google Chrome click on Register with a blank account password
  displayed `Account password is required.`, focused the account-password input,
  and emitted **zero** `/api/auth/*` requests.

The first deploy attempt exposed a stale `app.js?v=480` browser cache entry even
though the server asset was current. PR #496 added a TDD-protected `v=487` cache
key; the final evidence above was collected only after that follow-up merge and
redeploy.

## Current product truth

The Web, Android, and extension surfaces received the UI normalization merged in
#481. This audit did not convert preview/session-only surfaces into full clients:
the extension still lacks server-backed auth/pull, Windows/Linux remain preview
clients, and many parity checklist items remain open. The repository is now
  consistent about those limits, and the remaining audit follow-up queue starts
  at #490.
