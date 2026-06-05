# CLAUDE.md — Foxing Monorepo
## Read this at the start of every Claude Code session.
## Target: under 200 lines. Every line earns its place.

---

## BEHAVIOR

### Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing anything:
- State your assumptions explicitly. If uncertain, ask before proceeding.
- If multiple interpretations exist, present them — don't pick silently and run.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear or contradictory, stop. Name what's confusing. Ask.
- If a third-party constraint (library version, platform limitation) blocks the
  intended approach, say so immediately with a specific alternative.

### Simplicity First
Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- If an approach requires a canary/experimental feature on a stable release, say
  so before writing a single line — don't build it and discover the conflict later.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't improve adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

### Goal-Driven Execution
Define success criteria. Loop until verified.

For multi-step tasks, state a brief plan before starting:
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
  3. [Step] → verify: [check]

Transform vague tasks into verifiable goals:
- "Fix the cache issue" → "Public pages return x-vercel-cache: HIT on second request"
- "Fix the bug" → "The specific error no longer appears in logs after the change"
- "Refactor X" → "tsc --noEmit passes before and after, behavior is identical"

Strong success criteria let you loop independently.
Weak criteria ("make it work") require constant clarification.

---

## AUTONOMY

Proceed without asking for confirmation on clear tasks.
Make decisions and continue. Do not pause to check in mid-task.
Only stop if you hit an actual unresolvable error or a genuine ambiguity
where the two interpretations would produce meaningfully different code.
Never ask "should I proceed?" or "would you like me to continue?" — just do it.
Do ask if the task scope is genuinely unclear before starting — not during.

---

## HOOKS (deterministic enforcement)

CLAUDE.md rules are guidance (~80% adherence). Hooks are 100% deterministic.
The hard rules below are also enforced via .claude/settings.json hooks.
Do not modify .claude/settings.json without explicit instruction.

Hard rules enforced by hooks:
- Em dash check runs automatically after every file edit (PostToolUse)
- tsc --noEmit runs automatically before every session end (Stop)

---

## PROJECT

Foxing is a reading app + web platform. Letterboxd for books.
Monorepo: github.com/DrDustinEdwards/foxing

  apps/mobile/    — Expo React Native app (reader)
  apps/web/       — Next.js 14 web platform (foxing.app)
  packages/types/ — @foxing/types shared interfaces
  packages/utils/ — @foxing/utils shared helpers

Supabase project: ekjpsuewrkvqzbuteurc
Web deploy: Vercel (auto-deploys on push to main)
Domain: foxing.app

Storage: Cloudflare R2 (all new uploads go here, not Supabase)
  foxing-covers         covers for books and book clubs
  foxing-epubs          epub files for the reader
  foxing-avatars        user avatar images
  foxing-journal-images journal article inline images
  R2 helper: lib/r2.ts -- use uploadToR2() for all new uploads

---

## COMMANDS

Always run from the right directory:
  Mobile: cd apps/mobile
  Web:    cd apps/web
  Install/types/utils: repo root

SUPABASE CLI — always from repo root (supabase/ lives there, not in apps/web):
  npx supabase functions deploy [name] --project-ref ekjpsuewrkvqzbuteurc
  npx supabase secrets set KEY=value --project-ref ekjpsuewrkvqzbuteurc

Web build check before every push:
  cd apps/web && npx tsc --noEmit

---

## ABSOLUTE RULES

1. No em dashes. Not one. Grep before pushing:
   grep -r " — " apps/web/app apps/web/components --include="*.tsx" --include="*.ts"
   Must return 0 matches.

2. No hardcoded strings in metadata. All metadata uses lib/metadata.ts builders.

3. No cheesy copy. Read ai-writing-tells.md in the Foxing Vault before writing copy.
   No: "compelling", "must-read", "journey", "explore", "dive into", "discover"
   No: exclamation marks on empty states.
   No: "it's worth noting", "importantly", "furthermore".

4. All affiliate links: rel="sponsored noopener noreferrer"
   Bookshop.org always before Amazon.

5. Admin routes use createAdminClient() (service role). Never expose to browser.
   Auth routes use createServerClient() (cookies-based).
   generateStaticParams always uses createAdminClient() — never cookies.

6. URL patterns — never confuse these:
   /book/[slug]    not /book/[id]
   /author/jane-austen  not /author/Jane%20Austen
   /clubs/[slug]   not /clubs/[uuid]

7. Three distinct book club spaces — never mix them:
   /clubs              — user reading clubs
   /book-clubs         — celebrity picks (Oprah, Reese, etc.)
   /book-of-the-month  — Foxing's own monthly pick

8. npx tsc --noEmit must pass before every git push. No exceptions.

9. Never read, display, log, or reference the contents of .env files.

10. No emoji in UI, copy, badges, or code.
    The fox emoji in nav/footer/auth/admin is the only exception.

11. No icon libraries on web — inline SVG only.
    Mobile uses phosphor-react-native exclusively (NOT @phosphor-icons/react-native — that package does not exist on npm).

12. Web tasks: do NOT touch apps/mobile/.
    Mobile tasks: do NOT touch apps/web/.
    Single terminal per task. Never run two Claude Code sessions simultaneously.

13. DB migrations via Supabase MCP apply_migration only.
    Never run raw DDL in execute_sql.

14. Two tiers only: free and plus.
    Never reference any other tier name in code, copy, or schema.

15. Cover images go to Supabase Storage bucket 'covers' only.
    Never store third-party image URLs as cover_url — always download and store.
    See the covers skill for lookup order and stub detection logic.

---

## DB FACTS

Key columns (all migrations applied):
  books:        slug, author_slug, cover_url, epub_url, themes, mood_tags,
                pacing, content_warnings, weighted_rating, isbn, isbn13,
                series_name, series_order, amazon_url, bookshop_url
  user_books:   rating_half (1-10), date_started, date_finished, paused_note
  profiles:     is_admin, subscription_tier (free/plus/patron), is_suspended,
                total_books_read, total_highlights, backdrop_url, is_public,
                theme_preference (light/dark/system)
  clubs:        slug (name + 4-char id suffix)
  reading_lists: slug, is_featured, like_count
  diary_entries: slug (book_slug + date), privacy (private/public/friends)
  highlights:   like_count, updated_at
  external_book_club_picks: curator_quote, is_published, is_auto_discovered

---

## SKILLS (load on demand, not every session)

Task-specific context lives in .claude/skills/ — Claude loads these only when needed.
Do not put task-specific instructions in this file; put them in a skill instead.

Available skills (invoke with /skill-name or reference in your prompt):
  covers    — cover image lookup order, stub detection, storage rules
  botm      — Book of the Month admin workflow
  picks     — celebrity picks automation spec

---

## VAULT FILES (detailed specs via Foxing Vault MCP)

  context.md                    — current production state, checklist
  ai-writing-tells.md           — writing rules (read before any copy)
  design-system.md              — color tokens, typography
  celebrity-picks-automation.md — picks automation spec

---

## GIT WORKFLOW

Small focused commits. One concern per commit.
Commit message: "What it does" not "Why it does it"
  Good: "Add admin link to nav, settings page"
  Bad:  "Fix navigation issues for admin users"

If build fails: read the error, fix the specific file, push immediately.
Do not accumulate multiple fixes in a draft.

## CONTEXT WINDOW

Start a fresh session per task. Use /clear between unrelated tasks.
At 60% context usage, wrap up the current task and start a new session.
Quality degrades before the limit — don't wait for the warning.
