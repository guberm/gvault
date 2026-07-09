---
title: Browser extension session fill flow
created: 2026-07-09
updated: 2026-07-09
type: flow
status: pilot
sources:
  - path: apps/browser-extension/src/service-worker.js
    note: MV3 message routing and matching logic.
  - path: tests/browser-extension-service-worker-save-prompt.test.mjs
    note: Service-worker behavior tests for save/update/autofill/match rules.
  - path: docs/roboform-parity-checklist.md
    note: Browser extension server-backed status is still unchecked.
  - path: docs/roboform-parity-issue-index.md
    note: Browser extension task issue links.
---

# Browser extension session fill flow

The browser extension currently has meaningful **session-fill** logic, but the parity checklist still treats the extension as **not yet a real server-backed vault client**.

## Current service-worker path

`apps/browser-extension/src/service-worker.js` listens for runtime messages:

- `GV_FORMS_DETECTED` — computes matching session logins for the page, optionally records `lastDetectedForms`, fills automatically when exactly one match exists, or stores `pendingFillChoices` when multiple matches exist and prompts are enabled.
- `GV_SAVE_SESSION_LOGIN` — saves a normalized login to `chrome.storage.session` as `sessionAutofill` and into `sessionAutofillLogins`.
- `GV_FILL_CHOICE` — validates a selected pending login against the current tab before filling.
- `GV_LOGIN_SUBMITTED` — creates either `pendingUpdateLogin` for changed known credentials or `pendingSaveLogin` for a new login, subject to autosave and disabled-domain settings.
- Dismiss messages clear pending save/update prompts.

## Matching behavior

The service worker normalizes hosts by stripping leading `www.` and lowercasing. Domain matching includes:

- exact host equality;
- parent-domain-to-subdomain match by default via `hostMatchesSubdomainRule`;
- configured equivalent-domain groups;
- per-login `matchMode`: `domain`, `exact-host`, `url-exact`, or `url-prefix`.

`gvSubdomainMatchingEnabled: false` disables the parent-domain subdomain match.

## Tests as current behavior proof

`tests/browser-extension-service-worker-save-prompt.test.mjs` covers the session behavior, including:

- pending save prompt for unknown submitted login;
- update prompt for changed known login;
- `www.` normalization;
- autosave disable behavior;
- exact default autofill for one session login;
- parent-domain session autofill on subdomain by default;
- disabled subdomain matching;
- exact-host / URL match controls.

## Product-status guardrail

Do not infer that the browser extension is production/server-backed because service-worker session fill tests pass. `docs/roboform-parity-checklist.md` still has extension auth, server-backed pull/fill, popup login/register, and Chrome/Edge proof unchecked.

## Related pages

- [Browser extension is session-first](../gotchas/browser-extension-is-session-first.md)
- [RoboForm parity truth gate](../decisions/roboform-parity-truth-gate.md)
