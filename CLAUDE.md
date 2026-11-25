# CLAUDE.md - Foxing monorepo

Foxing: a reading app and web platform ("Letterboxd for books"), foxing.app.

## Rules every repo shares

- **Tests.** Reproduce a reported failure before fixing it, and report red before and green after. Keep the minimal set: a few browser tests for flows that must never break, one integration test per real behavior, unit tests only for tricky logic, shared code tested once where it lives. Remove a test that pins design, repeats coverage or never caught a mistake, unless it guards a harm that cannot be undone.
- **UI copy.** Let the layout explain: no eyebrows, restating subtitles, "this page lets you" intros, hints a label already gives or empty-state essays. Labels, accessible names, errors, one-way warnings and legal text stay (Dustin, 2026-11-18; capsid/conventions.md).
- **Shared code.** Before writing anything another site might have, check https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md. Change shared code in place and delete what the change replaces in the same PR.
- **Browser support.** devkit's docs/browser-support.md: Baseline Widely available freely, Newly available with a small fallback, Limited only feature-detected, no polyfills.
- **Secrets.** Never commit or print a key, token, `.dev.vars` or `.env`.
- **Deploys.** A merge to the default branch deploys; never deploy from a session.
- **D1.** Never hand-run production DDL; CI applies additive migrations and refuses the rest. Back up and restore with d1-dump, never `wrangler d1 export` (it fails on FTS5 tables).
- **Site copy and AI.** Copy describes only what the current build does. An AI provider key stays on the server, never in a client.

## Layout

    apps/mobile/    Expo React Native reader
    apps/web/       React Router 8 web platform on Cloudflare Workers
    packages/core/  @foxing/core: Drizzle schema, repositories, domain logic
    packages/api/   @foxing/api: Hono routes (the /api/v1 surface)
    packages/types/ @foxing/types: shared interfaces
    mcp/            Foxing Admin MCP: own Worker, npm package

Web stack: Workers, D1, R2, KV, React Router 8 framework mode. An npm workspaces monorepo. Node 26 (`.nvmrc`).

## Commands

Run mobile commands in `apps/mobile`, web in `apps/web`; install at the root.

- Root: `npm run dev:web`, `dev:mobile`, `build:web`, `type-check` (both apps), `lint` (Oxlint, `oxlint.config.ts`).
- Deploy (`deploy` job in `.github/workflows/ci-cf.yml`) runs only while the repository variable `CF_DEPLOY` is `true`.
- D1 migrations: author with drizzle-kit in `packages/core` (`packages/core/migrations`), apply with wrangler.

## Backup

The Worker's nightly cron dumps D1 into the private `BACKUPS` bucket with d1-dump (`apps/web/app/lib/backup.server.ts`); restore with the d1-dump README.

## Hard rules

A rule stays here only if it stops a real, costly mistake that nothing else catches.

1. Affiliate links carry `rel="sponsored noopener noreferrer"`. Bookshop.org always before Amazon.
2. Web tasks never touch `apps/mobile/`, mobile never `apps/web/`.
3. Public domain books only: no licensing, publisher deals, royalties or ISBNs in the catalog. EPUBs are fetched once and stored in our R2, never deep-linked to Project Gutenberg, because its Terms of Use forbid it.
4. The Anthropic SDK stays out of the React Native bundle. The client sends only the minimal fields (action, bookId, threadId, message, selection, targetLanguage); the server builds every prompt and its context.
5. Reads are core repositories called from React Router loaders; writes are /api/v1 Hono routes. A failed read is never swallowed into an empty state.
6. `club_threads.is_ai_starter` marks AI-generated starters only, never a thread a person posts.
7. Free is the whole reading and social product; Plus is the AI companion. Prices and what moves between tiers are Dustin's call.
8. e2e signs in through the visible form, and the seeded account e2e@foxing.app stays on the free tier.
9. Do not delete or build on `apps/discord` until Dustin decides what Discord is for.
