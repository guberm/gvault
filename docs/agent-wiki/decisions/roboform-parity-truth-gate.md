---
title: RoboForm parity truth gate
created: 2026-07-09
updated: 2026-07-09
type: decision
status: pilot
sources:
  - path: docs/roboform-parity-checklist.md
    note: Canonical parity checklist and instructions for checked vs unchecked items.
  - path: docs/roboform-parity-issue-index.md
    note: GitHub issue mapping for checklist tasks.
  - path: README.md
    note: Clean-room scope and non-production-audited status.
---

# RoboForm parity truth gate

GVault uses the RoboForm parity checklist as a product truth gate: only verified implementation counts.

`docs/roboform-parity-checklist.md` gives the rule directly:

- Use `[x]` only for items that are implemented **and verified**.
- Use `[ ]` for not implemented, partial, or unverified items.
- If a feature is partially done, keep the parent unchecked and check only verified sub-parts.
- Do not check UI-only stubs that are not backed by server/API/crypto where required.

## Agent rule

When implementing GVault parity work:

1. Read the relevant checklist section and issue index first.
2. Treat unchecked items as not product-complete even if some UI or tests exist.
3. After implementing behavior, update checklist only with real build/run/device/browser proof.
4. Keep parent items unchecked until the whole parent behavior is complete.
5. Cite exact issue numbers from `docs/roboform-parity-issue-index.md` when mapping work to GitHub.

## Current snapshot examples

From the current checklist snapshot:

- Web and Android have multiple verified server-backed items.
- Deployment persistence is still unchecked.
- Browser extension, Windows desktop, and Linux client are not yet real server-backed clients at the top-level snapshot.
- Browser extension tasks such as popup login/register, vault pull, one-click fill, save/update prompt, disabled-domain rules, multiple credentials, and equivalent domains are tracked separately.

## Related pages

- [Browser extension session fill flow](../flows/browser-extension-session-fill.md)
- [Browser extension is session-first](../gotchas/browser-extension-is-session-first.md)
- [Zero-knowledge boundary](../architecture/zero-knowledge-boundary.md)
