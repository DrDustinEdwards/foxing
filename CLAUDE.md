# CLAUDE.md -- Foxing Monorepo
## Read this at the start of every Claude Code session.
## Always-on rules only. Reference material lives in the Foxing Vault.
## Path-scoped CLAUDE.md files auto-load under apps/web/app/api/, apps/web/app/admin/, and apps/mobile/.

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
  "Fix the cache issue" -> "Public pages return x-vercel-cache: HIT on second request"
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
  apps/web/       -- Next.js 14 web platform (foxing.app)
  packages/types/ -- @foxing/types shared interfaces
  packages/utils/ -- @foxing/utils shared helpers

Supabase project: ekjpsuewrkvqzbuteurc
Web deploy: Vercel (auto-deploys on push to main), domain: foxing.app

Storage: Cloudflare R2 (all new uploads, not Supabase).
  foxing-covers, foxing-epubs, foxing-avatars, foxing-journal-images
  Helper: `apps/web/lib/r2.ts` -- use `uploadToR2()` for all new uploads.

---

## COMMANDS

Always run from the right directory:
  Mobile: cd apps/mobile
  Web:    cd apps/web
  Install / types / utils: repo root

Supabase CLI -- always from repo root (supabase/ lives there):
  npx supabase functions deploy [name] --project-ref ekjpsuewrkvqzbuteurc
  npx supabase secrets set KEY=value --project-ref ekjpsuewrkvqzbuteurc

Web build check before every push:
  cd apps/web && npx tsc --noEmit

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

7. `npx tsc --noEmit` must pass before every git push. No exceptions.

8. Never read, display, log, or reference the contents of .env files.
   Env vars live in Vercel only.

9. No emoji in UI, copy, badges, or code.
   Two exceptions: the fox emoji in nav/footer/auth/admin, and emoji
   inside the reactions feature (reactions are user content, not chrome).

10. No icon libraries on web -- inline SVG only.
    Mobile uses `phosphor-react-native` exclusively (NOT
    `@phosphor-icons/react-native` -- that package does not exist on npm).

11. Web tasks: do NOT touch `apps/mobile/`. Mobile tasks: do NOT touch
    `apps/web/`. Single terminal per task. Never run two Claude Code
    sessions simultaneously.

12. DB migrations via Supabase MCP `apply_migration` only.
    Never run raw DDL in `execute_sql`.

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
