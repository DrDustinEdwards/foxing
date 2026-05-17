# Foxing

A mobile reading app for iOS and Android. The name comes from the brown spots 
that appear on the pages of beloved old books.

Foxing combines three things in a single unified experience:
1. A reader for public domain classic books
2. An AI companion that reads alongside you
3. A social book club layer with inline comments tied to specific passages

---

## Tech stack

- **Mobile app**: React Native + Expo (Expo Router for navigation)
- **Styling**: NativeWind (Tailwind for React Native)
- **Backend**: Supabase (Postgres database, auth, storage, realtime)
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Book content**: Gutendex API (Gutenberg), Standard Ebooks, Open Library API
- **EPUB rendering**: epub.js inside a WebView
- **Push notifications**: Expo Notifications
- **Builds**: Expo EAS

---

## Project structure

```
foxing/
    app/                        # Expo Router screens
        (auth)/                 # Auth screens
            login.tsx
            signup.tsx
            onboarding.tsx
        (tabs)/                 # Main tab navigation
            index.tsx           # Home / discover
            library.tsx         # User's library
            profile.tsx         # User profile
        book/
            [id].tsx            # Book detail page
        reader/
            [id].tsx            # The reading screen
    components/
        reader/                 # Reader-specific components
        ui/                     # Generic UI components
    lib/
        supabase.ts             # Supabase client (singleton)
        claude.ts               # Claude API client
        gutenberg.ts            # Gutendex API helpers
        standardebooks.ts       # Standard Ebooks helpers
        openlibrary.ts          # Open Library API helpers
    hooks/                      # Custom React hooks
    constants/                  # Colors, fonts, config
    assets/                     # Images, fonts
    CLAUDE.md                   # This file
```

---

## Coding conventions

- TypeScript throughout, no plain JS files ever
- Functional components only, no class components
- Custom hooks for all data fetching, no fetching inside components
- NativeWind for all styling, never use StyleSheet.create
- Supabase client is a singleton in lib/supabase.ts
- Claude API calls always go through lib/claude.ts, never call the API 
  directly from components
- All environment variables in .env, never hardcode keys anywhere
- File names: kebab-case for files, PascalCase for component names
- Percentage-based sizing and Flexbox everywhere, never fixed pixel widths
- Design mobile-first, add tablet breakpoints where layout genuinely benefits

---

## Environment variables

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
```

---

## Database schema (Supabase / Postgres)

### profiles
- id (uuid, references auth.users, primary key)
- username (text, unique)
- display_name (text)
- avatar_url (text, nullable)
- created_at (timestamptz, default now())

### books
- id (uuid, primary key)
- gutenberg_id (integer, nullable, unique)
- title (text)
- author (text)
- cover_url (text, nullable)
- source (text), 'gutenberg', 'standardebooks', 'openlibrary'
- epub_url (text)
- language (text, default 'en')
- subjects (text array)
- word_count (integer, nullable)
- created_at (timestamptz, default now())

### user_books
- id (uuid, primary key)
- user_id (uuid, references profiles)
- book_id (uuid, references books)
- status (text), 'want_to_read', 'reading', 'finished', 'abandoned'
- progress_cfi (text, nullable), EPUB CFI location string
- progress_percentage (float, default 0)
- started_at (timestamptz, nullable)
- finished_at (timestamptz, nullable)
- created_at (timestamptz, default now())

### vocabulary
- id (uuid, primary key)
- user_id (uuid, references profiles)
- book_id (uuid, references books)
- word (text)
- definition (text)
- context (text), the sentence the word appeared in
- created_at (timestamptz, default now())

### reading_sessions
- id (uuid, primary key)
- user_id (uuid, references profiles)
- book_id (uuid, references books)
- started_at (timestamptz)
- ended_at (timestamptz, nullable)
- pages_read (integer, default 0)
- created_at (timestamptz, default now())

### annotations (Phase 2, do not build yet)
### clubs (Phase 3, do not build yet)
### discussions (Phase 3, do not build yet)

---

## Book sources

### Gutendex (primary catalog)
- Base URL: https://gutendex.com/books/
- No API key required
- Use for: search, browse, metadata, EPUB download URLs
- Docs: https://gutendex.com

### Standard Ebooks (quality tier)
- Better formatted EPUBs than raw Gutenberg
- OPDS catalog: https://standardebooks.org/opds
- Use Standard Ebooks version when available, fall back to Gutenberg

### Open Library
- Base URL: https://openlibrary.org/api/
- Use for: cover images, additional metadata
- Covers: https://covers.openlibrary.org/b/id/{cover_id}-L.jpg

---

## AI features (Phase 1 only)

All AI calls use Anthropic Claude API with model claude-sonnet-4-20250514.
All calls go through lib/claude.ts, never call the API directly from components.
Max tokens: 1000 for word lookups, 2000 for passage analysis, 3000 for 
chapter summaries, 4000 for companion chat.

### Word lookup
Triggered when user taps any word while reading.
Send: the word, surrounding sentence, book title, author, publication era.
Return: contextual definition, etymology, usage in this specific context.

### Passage analysis
Triggered when user long presses a passage.
Menu options:
- Plain English rewrite
- Historical context
- Literary device identification (metaphor, irony, foreshadowing, etc.)
- Thematic significance
- Character motivation analysis

### Chapter summaries
- Before starting a chapter: catch-up summary of previous chapter
- After finishing a chapter: consolidation summary of completed chapter

### AI companion chat
- Full conversational chat about the current book
- Always has context: book title, author, current chapter, current position
- Spoiler-free mode (default on): AI refuses to reveal future events
- Spoiler mode: user can toggle on to ask about anything including the ending

### Vocabulary builder
- Every word the user looks up is automatically saved to their vocabulary table
- Vocabulary screen shows all saved words with definitions and context
- Organized by book

---

## Complete product roadmap

### Phase 1, Reader + AI Companion (current)
Core loop: find a book → read it → AI makes it richer.
- Book catalog (browse, search, filter)
- EPUB reader with full settings
- Reading progress sync
- Library management
- Reading streaks
- All AI features listed above
- Auth (email, Apple, Google)

### Phase 2, Highlights & Annotations
- Highlight in multiple colors with notes
- Annotation list view and export
- Personal commonplace book
- Quote card generator
- Share to social media

### Phase 3, Social Layer & Book Clubs
- Inline passage comments visible while reading
- Chapter-gated discussion threads
- Book club creation and management
- Member progress visibility
- Social feed and following system
- Public reading profiles

### Phase 4, Discovery & Personalization
- Personalized recommendations
- Mood-based and theme-based browsing
- Full book analysis (character maps, timelines, symbolism)
- AI literary criticism digest

### Phase 5, Gamification & Engagement
- Reading badges and achievements
- Community challenges
- Year in reading recap
- Shareable stats cards

### Phase 6, Language Learning
- Bilingual reading mode
- Grammar explanation in context
- Anki export for vocabulary

### Phase 7, Educational & Institutional
- Educator accounts and classroom clubs
- Student progress dashboards
- LMS integration
- Institutional licensing (B2B)

### Phase 8, Accessibility & Advanced Platform
- Full VoiceOver / TalkBack support
- Text to speech narration
- Dyslexia-friendly mode
- iPad dual-page layout
- Home screen and lock screen widgets
- Apple Watch companion

---

## Monetization

- Phase 1: Free only. Build the audience.
- Phase 2: Premium launches ($9.99/month or $59.99/year). AI + annotations 
  behind paywall. Amazon affiliate links on every book page.
- Phase 3: Club Host tier ($4.99/month). Creator clubs revenue share.
- Phase 4: Scholar tier ($14.99/month) for full book analysis.
- Phase 7: Institutional licensing. Biggest revenue potential.
- Future: Family plan, gift subscriptions, referral program.

---

## Current build status

Phase 1 in progress.
Do not build Phase 2 or later features unless explicitly instructed.
When in doubt, do less and do it better.