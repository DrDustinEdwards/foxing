# CLAUDE.md — Foxing Monorepo
## Read this at the start of every Claude Code session.

---

## AUTONOMY

Proceed without asking for confirmation or permission.
Make decisions and continue. Do not pause to check in.
If something is ambiguous, pick the most reasonable interpretation and proceed.
Only stop if you hit an actual unresolvable error.
Never ask "should I proceed?" or "would you like me to continue?" — just do it.

---

## PROJECT

Foxing is a reading app + web platform. Letterboxd for books.
Monorepo: github.com/DrDustinEdwards/foxing

  apps/mobile/   — Expo React Native app (reader)
  apps/web/      — Next.js 14 web platform (foxing.app)
  packages/types/ — @foxing/types shared interfaces
  packages/utils/ — @foxing/utils shared helpers

Supabase project: ekjpsuewrkvqzbuteurc
Web deploy: Vercel (auto-deploys on push to main)
Domain: foxing.app

---

## COMMANDS

Always run from the right directory:
  Mobile commands: cd apps/mobile
  Web commands:    cd apps/web
  Install:         run from repo root (pnpm install)
  Types/utils:     run from repo root

SUPABASE CLI — ALWAYS run from repo root, not apps/web:
  cd /path/to/foxing  (repo root, where supabase/ folder lives)
  npx supabase functions deploy [name] --project-ref ekjpsuewrkvqzbuteurc
  npx supabase secrets set KEY=value --project-ref ekjpsuewrkvqzbuteurc
  Running from apps/web will fail — supabase/ is not found there.

Web build check before every push:
  cd apps/web && npx tsc --noEmit

---

## ABSOLUTE RULES

1. No em dashes. Not one. ESLint will catch them. Grep before pushing:
   grep -r " — " apps/web/app apps/web/components --include="*.tsx" --include="*.ts"
   Must return 0 matches.

2. No hardcoded strings in metadata. All metadata uses lib/metadata.ts builders.
   No inline title/description strings in generateMetadata functions.

3. No cheesy copy. Read ai-writing-tells.md in the Foxing Vault.
   No: "compelling", "must-read", "journey", "explore", "dive into", "discover"
   No: exclamation marks on empty states
   No: "it's worth noting", "importantly", "furthermore"

4. All affiliate links: rel="sponsored noopener noreferrer"
   Bookshop.org always before Amazon.

5. Admin routes use createAdminClient() (service role). Never expose to browser.
   Auth routes use createServerClient() (cookies-based).
   generateStaticParams always uses createAdminClient() — never cookies.

6. Book URLs use slug not UUID: /book/[slug] not /book/[id]
   Author URLs use author_slug: /author/jane-austen not /author/Jane%20Austen
   Club URLs use slug: /clubs/[slug] not /clubs/[uuid]

7. Three distinct "book club" URL spaces — never confuse them:
   /clubs           — user reading clubs
   /book-clubs      — celebrity picks (Oprah, Reese, etc.)
   /book-of-the-month — Foxing's own monthly pick

8. npx tsc --noEmit must pass before every git push. No exceptions.

9. Never read, display, log, or reference the contents of .env files.
   Environment variables are secrets. Acknowledge they exist but never show values.

10. Cover images always go to Supabase Storage bucket 'covers'.
    Never store third-party image URLs as cover_url — always download and store.
    Cover lookup order: Open Library → Google Books (zoom=3) → iTunes (600x900bb)
    Stub detection: content-length < 200 bytes = not a real cover, try next source.

---

## DB FACTS

All migrations applied. Key columns that exist:
  books: id, slug, author_slug, title, author, description, cover_url,
         epub_url, source, source_type, themes, mood_tags, pacing,
         content_warnings, is_staff_pick, weighted_rating, rating_count,
         isbn, isbn13, series_name, series_order, series_position,
         amazon_url, bookshop_url, updated_at, created_at
  user_books: rating_half (1-10 half-star), date_started, date_finished,
              mood_tags, format_read, paused_note, review_likes, updated_at
  profiles: is_admin, subscription_tier (free/plus/patron), is_suspended,
            total_books_read, total_highlights, backdrop_url, is_public,
            theme_preference (light/dark/system)
  clubs: slug (name + 4-char id suffix)
  reading_lists: slug, is_featured, like_count
  diary_entries: slug (book_slug + date), privacy (private/public/friends)
  highlights: like_count, updated_at
  external_book_clubs: 30 clubs seeded
  external_book_club_picks: curator_quote, is_published (default TRUE),
    is_auto_discovered, auto_source, auto_confidence

---

## VAULT FILES

Read from the Foxing Vault MCP for detailed specs:
  context.md           — project overview and current state
  ai-writing-tells.md  — writing rules (read before writing any copy)
  design-system.md     — color tokens, typography
  celebrity-picks-automation.md — picks automation spec

---

## GIT WORKFLOW

Small focused commits. One concern per commit.
Commit message format: "What it does, not why"
  Good: "Add admin link to nav, settings page"
  Bad:  "Fix navigation issues for admin users"

After every push, Vercel auto-deploys. Check deployment state if needed.
If build fails: read the error, fix the specific file, push a fix commit immediately.
Do not accumulate multiple fixes in a draft — push each fix as soon as it's ready.
