# CLAUDE.md - Foxing monorepo

Foxing is a reading app and web platform ("Letterboxd for books") at foxing.app.

## Rules that come first

- The portfolio rules are in Capsid: `capsid/conventions.md`. Read it with this file and `foxing/core.md`. Where they disagree, conventions wins. Rulings for Foxing go in `foxing/decisions.md`; read `foxing/design-system.md` before design work.
- Path-scoped CLAUDE.md files load from their directory; `apps/mobile/` has one.
- This namespace also maps DrDustinEdwards/foxing-admin-mcp (label `admin-mcp`): the old admin MCP, Next.js on Vercel, to be tested and then rebuilt on Cloudflare or retired.

## Layout

    apps/mobile/    Expo React Native reader
    apps/web/       React Router 8 web platform on Cloudflare Workers
    packages/core/  @foxing/core: Drizzle schema, repositories, domain logic
    packages/api/   @foxing/api: Hono routes (the /api/v1 surface)
    packages/types/ @foxing/types: shared interfaces
    packages/utils/ @foxing/utils: shared helpers

Web stack: Workers, D1, R2, KV, React Router 8 framework mode. A pnpm and turborepo monorepo (`workspace:*` dependencies): use pnpm at the root; npm fails on the workspace protocol. Node 24.

**Git submodule:** `apps/mobile/libs/foliate-js`. Clone with `--recurse-submodules` or run `git submodule update --init`, or the mobile reader silently gets an empty library.

Supabase project `ekjpsuewrkvqzbuteurc` is kept ONLY for the mobile ai-companion edge function; the web platform does not use Supabase. All new uploads go to R2 (foxing-covers, foxing-epubs, foxing-avatars, foxing-journal-images) through `uploadToR2()` in `apps/web/lib/r2.ts`.

## Commands

Run from the right directory: mobile in `apps/mobile`, web in `apps/web`; install with `pnpm install` at the root.
- Root: `pnpm dev:web`, `pnpm dev:mobile`, `pnpm build:web`, `pnpm type-check` (both apps), `pnpm lint`, `pnpm lint:cf`.
- Web typecheck before a push: `cd apps/web && pnpm run type-check`.
- Web deploy: `cd apps/web && pnpm run deploy` promotes straight to production. Merging to main does not deploy.
- Secrets: `cd apps/web && npx wrangler secret put KEY`. Local env: `apps/web/.dev.vars` (gitignored).
- D1 migrations: author with drizzle-kit in `packages/core` (`packages/core/migrations`), apply with wrangler. Never Supabase MCP, never hand-run DDL against production.
- Supabase CLI only for the mobile ai-companion function, from `apps/mobile`: `npx supabase functions deploy ai-companion --project-ref ekjpsuewrkvqzbuteurc`. Never delete `apps/mobile/supabase` or merge the two trees.
- Private repo: CI shares Dustin's free monthly minutes, so heavy runs happen locally, one at a time.

## Backup: the whole-database export does not work here

`npx wrangler d1 export foxing` fails on the two FTS5 tables. Export per table, data only, hand-written content first:

```
npx wrangler d1 export foxing --remote --no-schema --table journal_posts --output export-journal_posts.sql
npx wrangler d1 export foxing --remote --no-schema --table annotations --output export-annotations.sql
npx wrangler d1 export foxing --remote --no-schema --table profiles --output export-profiles.sql
npx wrangler d1 export foxing --remote --no-schema --table books --output export-books.sql
```

`journal_posts` is original prose that exists nowhere else. Check counts on the other tables rather than trusting a list; Better Auth's tables regenerate on login. Never export `annotations_fts`, `books_fts` or any FTS shadow table. Restore: apply `packages/core/migrations`, then the data files (the FTS triggers refill the index on import; `INSERT INTO books_fts (books_fts) VALUES ('rebuild');` and the same for `annotations_fts` repair it). Check each export file actually contains INSERT rows. Full version: `foxing/protocol-backup.md` in Capsid. A nightly per-table backup job (d1-dump) is queued to replace this by hand.

## Hard rules

1. No hardcoded strings in metadata; all metadata uses the `lib/metadata.ts` builders.
2. Affiliate links carry `rel="sponsored noopener noreferrer"`. Bookshop.org always before Amazon.
3. URL patterns: `/book/[slug]` not `/book/[id]`; `/author/jane-austen` not `/author/Jane%20Austen`; `/clubs/[slug]` not `/clubs/[uuid]`.
4. Three separate club spaces, never mixed: `/clubs` user reading clubs; `/book-clubs` celebrity picks; `/book-of-the-month` Foxing's own pick.
5. Two tiers only: free and plus. No other tier name in code, copy or schema.
6. Covers go to R2 bucket `foxing-covers` via `uploadToR2('covers', ...)`; never store a third-party image URL as `cover_url`.
7. Cards use two variants from `components/ui/card.tsx` (content: border change and brand title on hover; entity: shadow change on hover); never hand-roll card hover. This is the current default until Foxing moves to Capsomer, which owns card behaviour after that.
8. Mobile icons: `phosphor-react-native` only (`@phosphor-icons/react-native` does not exist on npm).
9. Web tasks never touch `apps/mobile/`; mobile tasks never touch `apps/web/`.
