# Foxing mobile

The Foxing reader for iOS and Android: public-domain classics, an AI companion that
reads alongside you, and book clubs with discussion tied to passages.

## Stack

- React Native with Expo SDK 57 (Expo Router, New Architecture), NativeWind
- Data: the Foxing Worker's `/api/v1` through `@foxing/client` (TanStack Query), shared
  with the web app; offline reader writes sync through `/api/v1/sync`
- Sign-in: Better Auth's Expo client (Apple, Google, or a code sent by email)
- AI: `/api/v1/companion` on the Worker; the app holds no AI key
- Reader: react-native-readium
- Builds: EAS

## Local development

From the repository root:

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter mobile start
```

`EXPO_PUBLIC_API_URL` points a dev build at a preview Worker; it defaults to
https://foxing.app.

## Layout

```
app/          Expo Router screens: (auth), (tabs), book, reader, clubs, u/[username], ...
components/   Screen pieces, grouped by area; ui/ holds Screen and SheetScaffold
lib/          api.ts (the one connection), sync-queue.ts, reader helpers, import.ts
```

See `CLAUDE.md` for the conventions.
