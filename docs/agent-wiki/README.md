# GVault Agent Wiki

Repo-local wiki for future coding agents working on GVault.

This is a **pilot** inspired by CodeAlmanac/Karpathy-style LLM wiki patterns. It is not a second memory system and does not replace GBrain, source code, tests, or the existing RoboForm parity checklist.

## What belongs here

- Durable architecture context that costs time to rediscover.
- Cross-file flows, especially when behavior spans apps/packages/tests.
- Decisions and guardrails that should travel with the repository.
- Gotchas discovered from code, tests, docs, or reviewed chat/session context.

## What does not belong here

- Secrets, tokens, cookies, real credentials, or user vault data.
- Unreviewed chat summaries promoted as project truth.
- Temporary task status or “I fixed X today” logs.
- Broad restatements already obvious from one file.

## Truth hierarchy

1. Current code and tests.
2. Existing repo docs/checklists.
3. GitHub issues/PRs when referenced by current docs.
4. Reviewed chat/session-derived context, clearly marked as such.

If this wiki conflicts with current code, **current code wins** and the wiki must be updated.

## Start here

- [Schema](./SCHEMA.md)
- [Index](./index.md)
- [Zero-knowledge boundary](./architecture/zero-knowledge-boundary.md)
- [Encrypted sync flow](./flows/encrypted-sync.md)
- [Browser extension session fill flow](./flows/browser-extension-session-fill.md)
- [RoboForm parity truth gate](./decisions/roboform-parity-truth-gate.md)
- [Browser extension is session-first](./gotchas/browser-extension-is-session-first.md)
