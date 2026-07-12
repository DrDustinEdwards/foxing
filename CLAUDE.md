# CLAUDE.md -- Foxing Monorepo
## Read this at the start of every Claude Code session.
## Always-on rules only. Reference material lives in the Foxing Vault.
## Path-scoped CLAUDE.md files auto-load from their directory. apps/mobile/ has one.

---

## BEHAVIOR

### Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

- State assumptions explicitly. If uncertain, ask before proceeding.
- If multiple interpretations exist, present them -- don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If a third-party constraint (library version, platform limit) blocks the
  intended approach, name it immediately with a specific alternative.

### Simplicity First
Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If an approach requires a canary/experimental feature on a stable release,
  say so before writing a single line.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical Changes
Touch only what you must. Clean up only your own mess.

- Don't refactor adjacent code, comments, or formatting.
- Match existing style, even if you'd do it differently.
- Remove imports/variables YOUR changes orphaned. Don't remove pre-existing
  dead code unless asked -- mention it instead.
- Every changed line should trace directly to the user's request.

### Goal-Driven Execution
Define verifiable success criteria before starting multi-step tasks.

Transform vague tasks into checks tied to real outputs:
  "Fix the cache issue" -> "Public pages return cf-cache-status: HIT on second request"
  "Fix the bug"        -> "The specific error no longer appears in logs"
  "Refactor X"         -> "npx tsc --noEmit passes; behavior is identical"

---

## AUTONOMY

Proceed without asking for confirmation on clear tasks. Make decisions and
continue. Only stop on a genuine ambiguity where the two interpretations
would produce meaningfully different code. Never ask "should I proceed?"
mid-task -- just do it. Do ask if scope is unclear before starting.

---

## HOOKS (deterministic enforcement)

CLAUDE.md is guidance. Hooks are 100% deterministic.
Do not modify `.claude/settings.json` without explicit instruction.

Active hooks:
- Em dash check after every file edit (PostToolUse)
- `tsc --noEmit` before every session end (Stop, runs in `apps/web/`)
- dustin-workflow rules on SessionStart

Mobile-only sessions: the Stop hook's tsc step is expected to noop or warn
because it runs against `apps/web/`. Not a blocker.

---

## PROJECT

Foxing is a reading app + web platform. Letterboxd for books.
Monorepo: github.com/DrDustinEdwards/foxing

  apps/mobile/    -- Expo React Native reader (SDK 56 / RN 0.85.3)
  apps/web/       -- React Router v7 web platform on Cloudflare Workers (foxing.app)
  packages/core/  -- @foxing/core Drizzle schema, repositories, domain logic
  packages/api/   -- @foxing/api Hono routes (the /api/v1 surface)
  packages/types/ -- @foxing/types shared interfaces
  packages/utils/ -- @foxing/utils shared helpers

Web stack: Cloudflare Workers + D1 (SQLite) + R2 + KV, React Router v7 (framework mode).
Web deploy: `npm run deploy` from apps/web (react-router build + wrangler deploy).
  Promotes straight to production. Pushing to main does NOT deploy.
Domain: foxing.app.

Supabase project ekjpsuewrkvqzbuteurc is retained ONLY for the mobile ai-companion
edge function (see COMMANDS). The web platform does not use Supabase.

Storage: Cloudflare R2 (all new uploads, not Supabase).
  foxing-covers, foxing-epubs, foxing-avatars, foxing-journal-images
  Helper: `apps/web/lib/r2.ts` -- use `uploadToR2()` for all new uploads.

---

## COMMANDS

Always run from the right directory:
  Mobile: cd apps/mobile
  Web:    cd apps/web
  Install / core / api / types / utils: repo root

Web deploy (Cloudflare Workers):
  cd apps/web && npm run deploy   (react-router build + wrangler deploy)
  Promotes to production. Pushing to main does NOT deploy.

Web Worker secrets (production env):
  cd apps/web && npx wrangler secret put KEY
  Local dev env: apps/web/.dev.vars (gitignored). Never Vercel.

D1 database migrations (web):
  Author with drizzle-kit in packages/core (migrations in packages/core/migrations);
  apply to D1 with wrangler. Never Supabase MCP.

Web type check before every push:
  cd apps/web && npm run type-check   (react-router typegen + tsc --noEmit)

Supabase CLI -- ONLY for the retained mobile ai-companion edge function (intentional,
do NOT consolidate; there is no root supabase/ directory):
  ai-companion deploys from apps/mobile/supabase/functions (run the CLI from apps/mobile).
    The mobile tree holds the live AI backend.
  npx supabase functions deploy ai-companion --project-ref ekjpsuewrkvqzbuteurc
  npx supabase secrets set KEY=value --project-ref ekjpsuewrkvqzbuteurc
  Never delete apps/mobile/supabase or merge the two trees.

---

## ABSOLUTE RULES

1. No em dashes. Not one. Hook enforces this on every edit.

2. No hardcoded strings in metadata. All metadata uses `lib/metadata.ts`
   builders.

3. No cheesy copy. Read `ai-writing-tells.md` in the Foxing Vault before
   writing copy.
   No: "compelling", "must-read", "journey", "explore", "dive into", "discover"
   No: exclamation marks on empty states.
   No: "it's worth noting", "importantly", "furthermore".

4. All affiliate links: `rel="sponsored noopener noreferrer"`.
   Bookshop.org always before Amazon.

5. URL patterns -- never confuse these:
   /book/[slug]         not /book/[id]
   /author/jane-austen  not /author/Jane%20Austen
   /clubs/[slug]        not /clubs/[uuid]

6. Three distinct book club spaces -- never mix them:
   /clubs              -- user reading clubs
   /book-clubs         -- celebrity picks (Oprah, Reese, etc.)
   /book-of-the-month  -- Foxing's own monthly pick

7. Type check must pass before every git push. No exceptions. Web:
   `cd apps/web && npm run type-check` (react-router typegen + tsc --noEmit).

8. Never read, display, log, or reference the contents of env files.
   Web env vars live in Cloudflare Worker secrets (production) and
   apps/web/.dev.vars (local dev, gitignored). Never Vercel.

9. No emoji in UI, copy, badges, or code.
   Two exceptions: the fox emoji in nav/footer/auth/admin, and emoji
   inside the reactions feature (reactions are user content, not chrome).

10. No icon libraries on web -- inline SVG only.
    Mobile uses `phosphor-react-native` exclusively (NOT
    `@phosphor-icons/react-native` -- that package does not exist on npm).

11. Web tasks: do NOT touch `apps/mobile/`. Mobile tasks: do NOT touch
    `apps/web/`. Single terminal per task. Never run two Claude Code
    sessions simultaneously.

12. Web D1 migrations are authored with drizzle-kit in packages/core and
    applied with wrangler. Never Supabase MCP; never hand-run raw DDL
    against production.

13. Two tiers only: free and plus. Never reference any other tier name
    in code, copy, or schema.

14. Cover images go to R2 bucket `foxing-covers` via `uploadToR2('covers', ...)`.
    Never store third-party image URLs as `cover_url` -- always download
    and store. See the `covers` skill for lookup order and stub detection.

15. Card components use two variants only -- never invent new hover patterns:
    content: border-border-subtle -> border-border-interactive on hover,
             title -> brand-text
    entity:  shadow-sm -> shadow-md on hover, border stays subtle
    Import from `components/ui/card.tsx`. Never hand-roll card hover behavior.

16. Never name Claude / Anthropic / GPT / "LLM" in user-facing copy.
    Always say "AI". Exception: internal admin-only pages.

17. Wood-engraving illustration zone: the illustration palette is allowed
    only in standalone illustration assets (journal category art,
    marketing/OG art, future empty-state art), never in interactive
    components. Illustration hexes stay hardcoded by design, but every
    illustration must sit on a cream panel token (--section-cream) so it
    reads correctly in dark mode.

---

## SKILLS (load on demand)

Task-specific context lives in `.claude/skills/` -- loaded only when relevant.

Available skills:
  covers -- cover image lookup order, stub detection, storage rules
  botm   -- Book of the Month admin workflow
  picks  -- celebrity picks automation spec

---

## VAULT FILES (detailed specs via Foxing Vault MCP)

  context.md                    -- current production state, checklist
  database-columns.md           -- exact DB column names (read before queries)
  ai-writing-tells.md           -- writing rules (read before any copy)
  design-system.md              -- color tokens, typography
  monetization.md               -- pricing, paywall, tier gates
  features-complete.md          -- full route + feature inventory
  celebrity-picks-automation.md -- picks automation spec

---

## GIT WORKFLOW

Small focused commits. One concern per commit.
Commit message describes what it does, not why:
  Good: "Add admin link to nav, settings page"
  Bad:  "Fix navigation issues for admin users"

If build fails: read the error, fix the specific file, push immediately.
Do not accumulate multiple fixes in a draft.

## CONTEXT WINDOW

Start a fresh session per task. `/clear` between unrelated tasks.
At 60% context usage, wrap up and start a new session.
Quality degrades before the limit -- don't wait for the warning.
