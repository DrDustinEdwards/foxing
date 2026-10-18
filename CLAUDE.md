# CLAUDE.md - Foxing monorepo

Foxing: a reading app and web platform ("Letterboxd for books"), foxing.app.

## Rules that come first

- The portfolio rules are in Capsid: `capsid/conventions.md`. Read it with this file and `foxing/core.md`. Where they disagree, conventions wins. Rulings go in `foxing/decisions.md`; read `foxing/design-system.md` before design work.
- `apps/mobile/` has its own CLAUDE.md.
- This namespace also maps DrDustinEdwards/foxing-admin-mcp (label `admin-mcp`): the old Next.js-on-Vercel admin MCP, to be tested, then rebuilt on Cloudflare or retired.

## Layout

    apps/mobile/    Expo React Native reader
    apps/web/       React Router 8 web platform on Cloudflare Workers
    packages/core/  @foxing/core: Drizzle schema, repositories, domain logic
    packages/api/   @foxing/api: Hono routes (the /api/v1 surface)
    packages/types/ @foxing/types: shared interfaces
    packages/utils/ @foxing/utils: shared helpers
    mcp/            Foxing Admin MCP: own Worker, npm package

Web stack: Workers, D1, R2, KV, React Router 8 framework mode. A pnpm and turborepo monorepo: use pnpm at the root (npm fails on `workspace:*`). Node 24.

**Git submodule:** `apps/mobile/libs/foliate-js`. Clone with `--recurse-submodules` or run `git submodule update --init`, or the mobile reader silently gets an empty library.

Supabase project `ekjpsuewrkvqzbuteurc` is kept ONLY for the mobile ai-companion edge function; the web platform does not use it. Uploads go to R2 (foxing-covers, foxing-epubs, foxing-avatars, foxing-journal-images) through `uploadToR2()` in `apps/web/lib/r2.ts`.

## Commands

Run mobile commands in `apps/mobile`, web in `apps/web`; install at the root.
- Root: `pnpm dev:web`, `dev:mobile`, `build:web`, `type-check` (both apps), `lint`, `lint:cf`.
- Before a web push: `cd apps/web && pnpm run type-check`.
- Web deploy: a merge to main deploys (the `deploy` job in `.github/workflows/ci-cf.yml`, on while the repository variable `CF_DEPLOY` is `true`), then `e2e` runs against the live site. `cd apps/web && pnpm run deploy` still deploys by hand.
- Secrets: `cd apps/web && npx wrangler secret put KEY`; local env in gitignored `apps/web/.dev.vars`.
- D1 migrations: author with drizzle-kit in `packages/core` (`packages/core/migrations`), apply with wrangler. Never Supabase MCP or hand-run production DDL.
- Supabase CLI only for the mobile ai-companion function, in `apps/mobile`: `npx supabase functions deploy ai-companion --project-ref ekjpsuewrkvqzbuteurc`. Never delete `apps/mobile/supabase` or merge the trees.
- Private repo: CI shares Dustin's free monthly minutes; run heavy jobs locally, one at a time.

## Backup: the whole-database export does not work here

`npx wrangler d1 export foxing` fails on the two FTS5 tables.

**Nightly:** the Worker's `17 3 * * *` cron runs `runBackup` (`apps/web/app/lib/backup.server.ts`), a d1-dump of every table (JSON) into R2 bucket `foxing-backups` (binding `BACKUPS`) under `backups/json/<run id>/`. It skips `session`, `verification`, `account` and `push_tokens` (credentials; see `app/lib/backup-checks.ts`, checked against the schema by `test/backup.integration.test.ts`). A run failing its checks gets no `_complete.json` and fails the cron. `GET /health` reports `backup: { last_ok, age_hours, warning? }`, warning past 26 hours. Retention is d1-dump's default (14 daily, 8 weekly, 6 monthly). Restore and drill: the d1-dump README.

**By hand**, until a nightly dump is confirmed: export per table, data only, for `journal_posts` first, then `annotations`, `profiles`, `books`:

```
npx wrangler d1 export foxing --remote --no-schema --table <table> --output export-<table>.sql
```

`journal_posts` is original prose that exists nowhere else. Check other tables' counts; Better Auth tables regenerate at login. Never export `annotations_fts`, `books_fts` or FTS shadow tables. Restore: apply `packages/core/migrations`, then the data files (FTS triggers refill the index; `INSERT INTO books_fts (books_fts) VALUES ('rebuild');` and the same for `annotations_fts` repairs it). Check each file has INSERT rows. Full: `foxing/protocol-backup.md` in Capsid.

## Hard rules

1. No hardcoded strings in metadata; all metadata uses the `lib/metadata.ts` builders.
2. Affiliate links carry `rel="sponsored noopener noreferrer"`. Bookshop.org always before Amazon.
3. URL patterns: `/book/[slug]` not `/book/[id]`; `/author/jane-austen` not `/author/Jane%20Austen`; `/clubs/[slug]` not `/clubs/[uuid]`.
4. Three separate club spaces, never mixed: `/clubs` user reading clubs; `/book-clubs` celebrity picks; `/book-of-the-month` Foxing's own pick.
5. Two tiers only: free and plus; no other tier name anywhere.
6. Covers go to R2 bucket `foxing-covers` via `uploadToR2('covers', ...)`; never store a third-party image URL as `cover_url`.
7. Cards use the two variants in `components/ui/card.tsx` (content: border change and brand title on hover; entity: shadow change on hover); never hand-roll card hover. Default until Foxing moves to Capsomer, which then owns card behaviour.
8. Mobile icons: `phosphor-react-native` only (`@phosphor-icons/react-native` does not exist on npm).
9. Web tasks never touch `apps/mobile/`, mobile never `apps/web/`.
