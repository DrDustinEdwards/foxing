# CLAUDE.md - Foxing Monorepo

Portfolio-wide rules live in Capsid, not here. Read `capsid/conventions.md` first, then `foxing/core.md`. This file holds only what is true of this repo.

Path-scoped CLAUDE.md files auto-load from their directory. `apps/mobile/` has one.

## What this is

Foxing is a reading app + web platform. Letterboxd for books. Domain: foxing.app.

  apps/mobile/    Expo React Native reader (SDK 56 / RN 0.85.3)
  apps/web/       React Router v7 web platform on Cloudflare Workers
  packages/core/  @foxing/core Drizzle schema, repositories, domain logic
  packages/api/   @foxing/api Hono routes (the /api/v1 surface)
  packages/types/ @foxing/types shared interfaces
  packages/utils/ @foxing/utils shared helpers

Web stack: Cloudflare Workers + D1 + R2 + KV, React Router v7 (framework mode).

Supabase project ekjpsuewrkvqzbuteurc is retained ONLY for the mobile ai-companion edge function. The web platform does not use Supabase. Storage is Cloudflare R2 for all new uploads: foxing-covers, foxing-epubs, foxing-avatars, foxing-journal-images. Use `uploadToR2()` from `apps/web/lib/r2.ts`.

## Session ritual

Start: read `capsid/conventions.md`, then `foxing/core.md`.
End: write a `session-YYYY-MM-DD.md` episodic (type `episodic`, under ~2KB) to the foxing namespace.

Deeper context in the typed docs: `foxing/decisions.md`, `foxing/design-system.md` (read before any design work), `foxing/context.md`, and the rest of the namespace.

## Hooks (deterministic enforcement)

CLAUDE.md is guidance. Hooks are deterministic. Do not modify `.claude/settings.json` without explicit instruction.

Active hooks:
- Em dash check after every file edit (PostToolUse)
- `tsc --noEmit` before every session end (Stop, runs in `apps/web/`)
- dustin-workflow rules on SessionStart

Mobile-only sessions: the Stop hook's tsc step is expected to noop or warn because it runs against `apps/web/`. Not a blocker.

## Commands

Always run from the right directory. Mobile: `cd apps/mobile`. Web: `cd apps/web`. Install and packages: repo root.

- Web deploy: `cd apps/web && npm run deploy` (react-router build + wrangler deploy). Promotes straight to production. Pushing to main does NOT deploy.
- Web type check before every push: `cd apps/web && npm run type-check` (react-router typegen + tsc --noEmit).
- Web Worker secrets: `cd apps/web && npx wrangler secret put KEY`. Local dev env: `apps/web/.dev.vars` (gitignored). Never Vercel.
- D1 migrations (web): author with drizzle-kit in `packages/core` (migrations in `packages/core/migrations`), apply with wrangler. Never Supabase MCP; never hand-run raw DDL against production.
- Supabase CLI, ONLY for the retained mobile ai-companion edge function (intentional, do NOT consolidate; there is no root `supabase/` directory). Deploys from `apps/mobile/supabase/functions`, run the CLI from `apps/mobile`:
  `npx supabase functions deploy ai-companion --project-ref ekjpsuewrkvqzbuteurc`
  Never delete `apps/mobile/supabase` or merge the two trees.

## Hard rules

1. No hardcoded strings in metadata. All metadata uses the `lib/metadata.ts` builders.
2. All affiliate links: `rel="sponsored noopener noreferrer"`. Bookshop.org always before Amazon.
3. URL patterns, never confuse these:
   `/book/[slug]` not `/book/[id]`; `/author/jane-austen` not `/author/Jane%20Austen`; `/clubs/[slug]` not `/clubs/[uuid]`.
4. Three distinct book club spaces, never mix them:
   `/clubs` user reading clubs; `/book-clubs` celebrity picks (Oprah, Reese); `/book-of-the-month` Foxing's own monthly pick.
5. Two tiers only: free and plus. Never reference any other tier name in code, copy, or schema.
6. Cover images go to R2 bucket `foxing-covers` via `uploadToR2('covers', ...)`. Never store third-party image URLs as `cover_url`; always download and store. See the `covers` skill for lookup order and stub detection.
7. Card components use two variants only, never invent new hover patterns:
   content: `border-border-subtle` -> `border-border-interactive` on hover, title -> `brand-text`
   entity: `shadow-sm` -> `shadow-md` on hover, border stays subtle
   Import from `components/ui/card.tsx`. Never hand-roll card hover behavior.
8. Emoji exceptions (the canon bans emoji by default): the fox emoji in nav/footer/auth/admin, and emoji inside the reactions feature, which is user content, not chrome.
9. Icon exception: mobile uses `phosphor-react-native` exclusively. NOT `@phosphor-icons/react-native`; that package does not exist on npm.
10. Web tasks: do NOT touch `apps/mobile/`. Mobile tasks: do NOT touch `apps/web/`. Single terminal per task. Never run two Claude Code sessions simultaneously.

## Skills (load on demand)

Task-specific context lives in `.claude/skills/`, loaded only when relevant.

  covers  cover image lookup order, stub detection, storage rules
  botm    Book of the Month admin workflow
  picks   celebrity picks automation spec
