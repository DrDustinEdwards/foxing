# CLAUDE.md - Foxing monorepo

Foxing: a reading app and web platform ("Letterboxd for books"), foxing.app.

## Rules that come first

- Tests: keep the minimal set (a few browser tests for flows that must never break, one integration test per real behaviour, unit tests only for tricky logic, shared code tested once where it lives), and remove any test that pins design, repeats coverage or has never caught a real mistake, unless it guards a harm that cannot be undone.
- Read `foxing/core.md` in Capsid with this file. Rulings go in `foxing/decisions.md`; read `foxing/design-system.md` before design work.

## Layout

    apps/mobile/    Expo React Native reader
    apps/web/       React Router 8 web platform on Cloudflare Workers
    packages/core/  @foxing/core: Drizzle schema, repositories, domain logic
    packages/api/   @foxing/api: Hono routes (the /api/v1 surface)
    packages/types/ @foxing/types: shared interfaces
    packages/utils/ @foxing/utils: shared helpers
    mcp/            Foxing Admin MCP: own Worker, npm package

Web stack: Workers, D1, R2, KV, React Router 8 framework mode. A pnpm and turborepo monorepo. Node 24.

**Git submodule:** `apps/mobile/libs/foliate-js`. Clone with `--recurse-submodules` or run `git submodule update --init`, or the mobile reader silently gets an empty library.

Supabase project `ekjpsuewrkvqzbuteurc` is kept ONLY for the mobile ai-companion edge function; the web platform does not use it.

## Commands

Run mobile commands in `apps/mobile`, web in `apps/web`; install at the root.
- Root: `pnpm dev:web`, `dev:mobile`, `build:web`, `type-check` (both apps), `lint`, `lint:cf`.
- Web deploy: a merge to main deploys (the `deploy` job in `.github/workflows/ci-cf.yml`, on while the repository variable `CF_DEPLOY` is `true`), then `e2e` runs against the live site. `cd apps/web && pnpm run deploy` still deploys by hand.
- D1 migrations: author with drizzle-kit in `packages/core` (`packages/core/migrations`), apply with wrangler. Never Supabase MCP or hand-run production DDL.
- Supabase CLI only for the mobile ai-companion function, in `apps/mobile`: `npx supabase functions deploy ai-companion --project-ref ekjpsuewrkvqzbuteurc`. Never delete `apps/mobile/supabase` or merge the trees.
- Private repo: CI shares Dustin's free monthly minutes; run heavy jobs locally, one at a time.

## Backup: the whole-database export does not work here

`npx wrangler d1 export foxing` fails on the two FTS5 tables.

**By hand**, until a nightly dump is confirmed: export per table, data only, for `journal_posts` first, then `annotations`, `profiles`, `books`:

```
npx wrangler d1 export foxing --remote --no-schema --table <table> --output export-<table>.sql
```

`journal_posts` is original prose that exists nowhere else. Check other tables' counts; Better Auth tables regenerate at login. Never export `annotations_fts`, `books_fts` or FTS shadow tables. Restore: apply `packages/core/migrations`, then the data files (FTS triggers refill the index; `INSERT INTO books_fts (books_fts) VALUES ('rebuild');` and the same for `annotations_fts` repairs it). Check each file has INSERT rows. Full: `foxing/protocol-backup.md` in Capsid.

## Hard rules

1. Affiliate links carry `rel="sponsored noopener noreferrer"`. Bookshop.org always before Amazon.
2. Web tasks never touch `apps/mobile/`, mobile never `apps/web/`.
