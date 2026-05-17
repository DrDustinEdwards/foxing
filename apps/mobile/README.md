# Foxing

A mobile reading app for iOS and Android. The name comes from the brown
spots that appear on the pages of beloved old books.

Foxing combines three things in a single unified experience:

1. A reader for public domain classic books
2. An AI companion that reads alongside you
3. A social book club layer with inline comments tied to specific passages (Phase 3)

---

## Status

**Phase 1, Reader + AI Companion (current)**

- Book catalog (Gutendex API)
- EPUB reader with full settings (font size, line height, light/sepia/dark)
- Reading progress sync
- Library management (want to read / reading / finished)
- AI features: word lookup, passage analysis, chapter summaries, companion chat
- Vocabulary builder
- Auth (email/password, Apple/Google planned)

---

## Tech stack

- **Mobile app**: React Native + Expo (Expo Router)
- **Styling**: NativeWind
- **Backend**: Supabase (Postgres, auth, storage)
- **AI**: Anthropic Claude (`claude-sonnet-4-20250514`)
- **Book content**: Gutendex (Gutenberg), Standard Ebooks, Open Library
- **EPUB rendering**: epub.js inside a WebView
- **Push notifications**: Expo Notifications
- **Builds**: Expo EAS

---

## Local development

### Prerequisites

- Node.js 20+
- Expo Go on a device, or an iOS Simulator / Android Emulator

### Setup

```bash
npm install --legacy-peer-deps
cp .env.example .env
# Then edit .env and fill in real values
```

### Environment variables

Set in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
```

`EXPO_PUBLIC_*` values are bundled into the client. `ANTHROPIC_API_KEY` is
read at runtime; for production you should proxy Claude calls through a
backend rather than calling the API directly from the device.

### Database

Apply the SQL in `supabase/migrations/001_initial_schema.sql` against your
Supabase project. It creates the `profiles`, `books`, `user_books`,
`vocabulary`, and `reading_sessions` tables with RLS policies and the
auth-user → profile trigger.

### Running

```bash
npx expo start
```

Then press `i` for iOS, `a` for Android, or scan the QR code with Expo Go.

---

## Project structure

```
foxing/
  app/                        Expo Router screens
    (auth)/                   Sign in / sign up
    (tabs)/                   Discover · Library · Profile
    book/[id].tsx             Book detail
    reader/[id].tsx           Reader screen (EPUB + AI)
  components/
    reader/                   Reader-specific UI
    ui/                       Generic UI
  lib/
    supabase.ts               Supabase client
    claude.ts                 Claude API helpers
    gutenberg.ts              Gutendex helpers
    standardebooks.ts         Standard Ebooks OPDS helpers
    openlibrary.ts            Open Library helpers
  constants/colors.ts         Shared palette
  supabase/migrations/        SQL schema
```

See `CLAUDE.md` for the full roadmap, schema, and coding conventions.
