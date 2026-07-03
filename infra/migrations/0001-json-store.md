# 0001 JSON Store

Initial persistence uses `GV_DATA_DIR/gvault-store.json`.

Schema:
- `users`;
- `devices`;
- `records`.

Migration target:
- move to SQLite or Postgres;
- preserve encrypted record blobs without decryption;
- add indexes for `ownerId`, `updatedAt`, and `revision`.
