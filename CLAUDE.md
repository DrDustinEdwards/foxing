# CLAUDE.md - foxing

Foxing, a reading app and web platform, foxing.app: `apps/mobile` (Expo), `apps/web` (React Router 8 on Workers), `packages/*`. npm workspaces, Node 26.

## Rules every repo shares

- **Tests.** Reproduce a reported failure before fixing it: red before, green after.
- **UI copy.** No eyebrows, restating subtitles, intros or hints a label already gives (Dustin, 2026-11-18).
- **Shared code.** Check devkit's [SHARED.md](https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md) before writing anything another repo might have; change it in place.
- **Secrets.** Never commit or print a key or token. AI provider keys stay on the server.
- **Production.** Never deploy, tag, release or run production DDL from a session; a merge deploys. Back up and restore D1 only with d1-dump.

## Rules for this repo

- **Affiliate links.** Carry `rel="sponsored noopener noreferrer"`; Bookshop.org always before Amazon.
- **Public domain.** Public domain books only: no licensing, publisher deals, royalties or ISBNs. EPUBs are fetched once into our R2, never deep-linked to Project Gutenberg (its Terms forbid it).
- **AI.** The Anthropic SDK stays out of the React Native bundle. The client sends only minimal fields; the server builds every prompt.
- **Tiers.** Free is the whole reading and social product; Plus is the AI companion. Prices and what moves between tiers are Dustin's call.
- **Discord.** Do not delete or build on `apps/discord` until Dustin decides what it is for.

## Commands

- Install at the root; `npm run type-check` and `npm run lint` there.
