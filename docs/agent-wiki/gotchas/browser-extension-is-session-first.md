---
title: Browser extension is session-first
created: 2026-07-09
updated: 2026-07-09
type: gotcha
status: pilot
sources:
  - path: README.md
    note: Browser extension is described as form detection/manual fill package.
  - path: docs/architecture/known-limitations.md
    note: Earlier limitation note about extension not yet connected to encrypted vault API.
  - path: docs/roboform-parity-checklist.md
    note: Current extension server-backed/auth/fill tasks remain unchecked.
  - path: apps/browser-extension/src/service-worker.js
    note: Current session storage and message behavior.
  - path: tests/browser-extension-service-worker-save-prompt.test.mjs
    note: Current test coverage for session fill/save/update prompts.
---

# Browser extension is session-first

Gotcha: the browser extension can look more complete than it is because service-worker session fill behavior is substantial.

Current repo evidence shows:

- `README.md` describes `apps/browser-extension` as a Chrome/Firefox/Edge MV3 package for form detection and manual fill.
- `apps/browser-extension/src/service-worker.js` stores session logins in `chrome.storage.session`, detects forms, fills one matching session login, handles multiple pending choices, and creates pending save/update prompts.
- `tests/browser-extension-service-worker-save-prompt.test.mjs` covers that session behavior thoroughly.
- `docs/roboform-parity-checklist.md` still leaves extension auth, default production URL, server-backed vault pull, one-click selected credential fill, Chrome proof, and Edge proof unchecked.

## Why this matters

A future agent might see passing extension tests and conclude the extension is a real vault client. That would be wrong unless server-backed auth/pull/fill is implemented and verified.

## Safe wording

Use:

> Browser extension has session-based form detection/fill/save-update prompt logic.

Do not use until verified:

> Browser extension is a real server-backed GVault client.

## Related pages

- [Browser extension session fill flow](../flows/browser-extension-session-fill.md)
- [RoboForm parity truth gate](../decisions/roboform-parity-truth-gate.md)
