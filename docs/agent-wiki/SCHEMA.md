# GVault Agent Wiki Schema

## Domain

GVault repo-local agent context: architecture boundaries, implementation flows, parity decisions, and gotchas for future coding agents.

## Conventions

- File names: lowercase kebab-case markdown.
- Every non-index page starts with YAML frontmatter.
- Every factual claim should have either:
  - a source path in `sources:` frontmatter, or
  - an inline evidence note naming the source file/function/test.
- Prefer repo-relative paths such as `apps/server/src/index.ts`.
- Do not copy secrets or real user vault data.
- Do not promote chat/session facts unless explicitly reviewed and labelled.
- If a generated page affects product claims, verify against code/tests/docs before marking it durable.

## Frontmatter

```yaml
---
title: Page title
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: architecture | flow | decision | gotcha
status: pilot | active | stale
sources:
  - path: README.md
    note: Replace this example with the repo-relative source path that supports the page.
---
```

## Review gate

Before committing wiki changes:

1. Check every `sources[].path` exists.
2. Check all relative markdown links resolve.
3. Run `git diff --check`.
4. Run the smallest useful repo check. For docs-only changes, `npm run lint` is usually enough because it scans markdown for forbidden copied branding references.
5. If a page claims behavior, verify the cited code/test/doc still says that.

## Page thresholds

Create or update a page when the context is durable and cross-cutting:

- cross-file flow;
- non-obvious security boundary;
- parity checklist rule;
- recurring implementation gotcha;
- decision that should guide future agents.

Do not create pages for passing mentions or single-line facts that are easier to rediscover than maintain.
