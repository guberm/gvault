# 0001 JSON Store

Initial persistence uses `GV_DATA_DIR/gvault-store.json`.

Schema:
- `schemaVersion: 1`;
- `users`;
- `devices`;
- `records`.

The server validates the complete version-1 persistence envelope before use. A
missing or unknown version and malformed rows fail closed. There is no legacy
unversioned migration: future schema changes must add an explicit, lock-held,
rollback-tested migration before the accepted version is advanced.

Version 1 uses a local cross-process writer lock, unique temporary files,
fsync-backed atomic replacement, and `gvault-store.json.bak` as the last valid
rollback snapshot. This is a bounded single-node format, not a shared-filesystem
or multi-node data layer. See `docs/deployment/self-hosted.md` for the operator
backup and restore procedure.

Scale-out migration target:
- move to SQLite or Postgres;
- preserve encrypted record blobs without decryption;
- add indexes for `ownerId`, `updatedAt`, and `revision`.
