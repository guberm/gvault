# GVault Agent Wiki Index

> Pilot repo-local agent wiki. Read `SCHEMA.md` first.
> Last updated: 2026-07-09 | Pages: 5 content pages + schema/index/log.

## Architecture

- [Zero-knowledge boundary](./architecture/zero-knowledge-boundary.md) — client/server responsibility split and what the server can/cannot see.

## Flows

- [Encrypted sync flow](./flows/encrypted-sync.md) — how encrypted records move through pull/push/conflict endpoints.
- [Browser extension session fill flow](./flows/browser-extension-session-fill.md) — current MV3 service-worker session fill/save/update behavior.

## Decisions

- [RoboForm parity truth gate](./decisions/roboform-parity-truth-gate.md) — only checked parity items backed by real implementation and verification count as done.

## Gotchas

- [Browser extension is session-first](./gotchas/browser-extension-is-session-first.md) — extension has growing fill logic but is not yet a server-backed vault client.
