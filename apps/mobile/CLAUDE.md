# Mobile App Rules

Expo React Native reader. Expo SDK 56, New Architecture enabled,
RN 0.85.3. Reader runs react-native-readium 5.0.0-rc.17.

Product spec, DB schema, feature inventory, and roadmap all live in the
Foxing Vault (`context.md`, `features-complete.md`, `monetization.md`,
`foxing_epub_sources.md`). Do not duplicate them here.

## Boundaries

- Mobile tasks: do NOT touch `apps/web/`.
- Web tasks: do NOT touch `apps/mobile/`.
- Shared interfaces live in `packages/types`; shared helpers in
  `packages/utils`. Move code there only when both apps actually need it.

## Icons

`phosphor-react-native` exclusively. The npm package
`@phosphor-icons/react-native` does NOT exist -- if a docs page tells you
to install it, the docs are wrong.

## Styling

NativeWind (Tailwind for React Native). Never `StyleSheet.create`.
Percentage-based sizing and Flexbox; no fixed pixel widths except for
icon sizes and chrome heights. Design tokens come from `tailwind.config.js`
in this directory.

After changing `tailwind.config.js` or NativeWind tokens, restart with
`expo start --clear`. Metro caches Tailwind output aggressively.

## TypeScript

TypeScript throughout. No plain `.js` files. Functional components only.

## Data layer

Supabase client is a singleton in `lib/supabase.ts`. Never instantiate
a new client in a component.

All AI calls go through the `ai-companion` Supabase Edge Function. Never
call the Anthropic API directly from the app -- the API key lives in the
Edge Function's Supabase vault, not the bundle.

Custom hooks for all data fetching. No `fetch` or Supabase queries inside
render bodies.

## File naming

- Files: kebab-case (`reading-streak-card.tsx`).
- Component names: PascalCase (`ReadingStreakCard`).

## Environment

`.env` and `.env.local` do not exist on this machine. Env vars come from
EAS / Expo's process env. Never display, log, or reference env-file
contents.

## Builds

EAS only -- Dustin watches the dashboard. Don't poll long-running cloud
builds from this session.
