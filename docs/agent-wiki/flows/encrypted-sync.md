---
title: Encrypted sync flow
created: 2026-07-09
updated: 2026-07-09
type: flow
status: pilot
sources:
  - path: docs/architecture/overview.md
    note: Sync endpoint and conflict model summary.
  - path: packages/sync/src/index.ts
    note: Request/response shapes, merge, and conflict detection.
  - path: apps/server/src/index.ts
    note: Runtime API routes for pull/push/export/import.
  - path: packages/vault-models/src/index.ts
    note: EncryptedVaultRecord fields.
---

# Encrypted sync flow

Current MVP sync is revision-based encrypted record pull/push.

## API surface

`docs/architecture/overview.md` names the current sync path:

- `POST /api/sync/pull`
- `POST /api/sync/push`

`apps/server/src/index.ts` implements those routes after `requireSession()` validates the bearer session.

## Pull

`POST /api/sync/pull`:

1. Reads optional `since` from request JSON.
2. Selects records owned by the authenticated user.
3. If `since` exists, returns only records with `updatedAt > since`.
4. Returns `{ serverTime, records, conflicts: [] }`.

The server returns encrypted records. It does not decrypt vault contents.

## Push

`POST /api/sync/push`:

1. Maps incoming `records` through `assertEncryptedRecord(record, userId)`.
2. Loads existing records for the same authenticated user.
3. Calls `detectConflicts(existing, incoming)`.
4. Upserts incoming non-conflicting records by `(ownerId, id)`.
5. Returns all current user records and any conflicts.

`packages/sync/src/index.ts` defines conflict detection as: current record exists, current `revision >= incoming.revision`, and ciphertext differs.

## Current limitations to remember

`docs/architecture/overview.md` explicitly says future production sync should add per-device vector clocks and explicit conflict records in client UI. Do not claim those are implemented until code/docs/tests prove it.

## Related pages

- [Zero-knowledge boundary](../architecture/zero-knowledge-boundary.md)
- [RoboForm parity truth gate](../decisions/roboform-parity-truth-gate.md)
