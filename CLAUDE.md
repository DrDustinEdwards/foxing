# CLAUDE.md - Foxing monorepo

Foxing: a reading app and web platform ("Letterboxd for books"), foxing.app.

## Rules that come first

- Tests: keep the minimal set (a few browser tests for flows that must never break, one integration test per real behavior, unit tests only for tricky logic, shared code tested once where it lives), and remove any test that pins design, repeats coverage or has never caught a real mistake, unless it guards a harm that cannot be undone.
- Read `foxing/core.md` in Capsid with this file. Before writing anything another site might have, read what the sites share: https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md (CI's shared-code check fails on a copy). Read `foxing/design-system.md` before design work.

## Layout

    apps/mobile/    Expo React Native reader
    apps/web/       React Router 8 web platform on Cloudflare Workers
    packages/core/  @foxing/core: Drizzle schema, repositories, domain logic
    packages/api/   @foxing/api: Hono routes (the /api/v1 surface)
    packages/types/ @foxing/types: shared interfaces
    packages/utils/ @foxing/utils: shared helpers
    mcp/            Foxing Admin MCP: own Worker, npm package

Web stack: Workers, D1, R2, KV, React Router 8 framework mode. A pnpm and turborepo monorepo. Node 26 (`.nvmrc`).

Supabase project `ekjpsuewrkvqzbuteurc` is kept ONLY for the mobile ai-companion edge function; the web platform does not use it.

## Commands

Run mobile commands in `apps/mobile`, web in `apps/web`; install at the root.
- Root: `pnpm dev:web`, `dev:mobile`, `build:web`, `type-check` (both apps), `lint`, `lint:cf`.
- Web deploy: a merge to main deploys (the `deploy` job in `.github/workflows/ci-cf.yml`, devkit's worker-deploy.yml, on while the repository variable `CF_DEPLOY` is `true`): it applies the D1 migrations, deploys, and rolls back if /health or the home page refuses it; then `e2e` runs against the live site. `cd apps/web && pnpm run deploy` still deploys by hand.
- D1 migrations: author with drizzle-kit in `packages/core` (`packages/core/migrations`), apply with wrangler. Never Supabase MCP or hand-run production DDL.
- Supabase CLI only for the mobile ai-companion function, in `apps/mobile`: `npx supabase functions deploy ai-companion --project-ref ekjpsuewrkvqzbuteurc`. Never delete `apps/mobile/supabase` or merge the trees.
- Public repo: never commit `wrangler.jsonc`, `.dev.vars`, a key or a secret; only the `.example` configs are committed.

## Backup

Nightly: the Worker's cron dumps D1 into the private `BACKUPS` R2 bucket with d1-dump (`apps/web/app/lib/backup.server.ts`); `/health` warns when the newest complete dump is over 26 hours old. Restore: the d1-dump README.

`npx wrangler d1 export foxing` fails on the two FTS5 tables. If a dump by hand is needed, export per table, data only, `journal_posts` first (original prose that exists nowhere else), then `annotations`, `profiles`, `books`:

```
npx wrangler d1 export foxing --remote --no-schema --table <table> --output export-<table>.sql
```

Never export `annotations_fts`, `books_fts` or FTS shadow tables. Restore by hand: apply `packages/core/migrations`, then the data files (check each has INSERT rows); `INSERT INTO books_fts (books_fts) VALUES ('rebuild');` and the same for `annotations_fts` repairs the index. Full: `foxing/protocol-backup.md` in Capsid.

## Hard rules

A rule stays here only if it stops a real, costly mistake that nothing else catches. Earlier rulings are in the version history of Capsid `foxing/decisions.md` (retired 2026-10-29).

1. Affiliate links carry `rel="sponsored noopener noreferrer"`. Bookshop.org always before Amazon.
2. Web tasks never touch `apps/mobile/`, mobile never `apps/web/`.
3. Public domain books only: no licensing, publisher deals, royalties or ISBNs in the catalog. EPUBs are fetched once and stored in our R2, never deep-linked to Project Gutenberg, because its Terms of Use forbid it.
4. The Anthropic API key never ships in a client, and the Anthropic SDK stays out of the React Native bundle. The client sends only the minimal fields (action, bookId, threadId, message, selection, targetLanguage); the server builds every prompt and its context.
5. Reads are core repositories called from React Router loaders; writes are /api/v1 Hono routes. A failed read is never swallowed into an empty state.
6. Marketing copy describes only what the current build does. `club_threads.is_ai_starter` marks AI-generated starters only, never a thread a person posts.
7. Free is the whole reading and social product; Plus is the AI companion. Prices and what moves between tiers are Dustin's call.
8. e2e signs in through the visible form, and the seeded account e2e@foxing.app stays on the free tier.
9. Do not delete or build on `apps/discord` until Dustin decides what Discord is for.
