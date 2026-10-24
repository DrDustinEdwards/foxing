# Mobile App Rules

Expo React Native reader. Expo SDK 57, New Architecture enabled,
RN 0.86.3. Reader runs react-native-readium 5.0.0-rc.17.

## Styling

NativeWind (Tailwind for React Native). Never `StyleSheet.create`.
Percentage-based sizing and Flexbox; no fixed pixel widths except for
icon sizes and chrome heights. Design tokens come from `tailwind.config.js`
in this directory.

## Layout primitives

All mobile screens use `<Screen>` (`components/ui/screen.tsx`); all sheets use
`<SheetScaffold>` (`components/ui/sheet-scaffold.tsx`). Keyboard handling is
`react-native-keyboard-controller` only (`KeyboardProvider` is mounted at the
app root). Never hand-roll `SafeAreaView`/`edges`/`KeyboardAvoidingView` or
manual `useSafeAreaInsets` padding in a screen or sheet -- the primitives own
the safe-area insets and the single keyboard layer. Never nest a `ScrollView`
inside `SheetScaffold` (its `KeyboardAwareScrollView` is the only scroller; pass
`scroll={false}` for fixed content).

## Data layer

Every read and write goes through the Worker's `/api/v1` with the shared
`@foxing/client` hooks (TanStack Query), the same ones the web app uses; `lib/api.ts`
is the one connection (Better Auth's Expo client, the query client, the offline sync
queue). Writes patch the cache optimistically. Reader writes that must survive being
offline (progress, sessions, highlights, words, library status) go through
`queueWrite` and `/api/v1/sync`. A screen with no API behind it is removed, not stubbed.

All AI goes through `/api/v1/companion` (`useCompanion`). Never call the Anthropic API
from the app; the key stays on the server. `supabase/` is the retired Edge Function
source, kept for reference; nothing in the app calls it.

## Builds

EAS only -- Dustin watches the dashboard. Don't poll long-running cloud
builds from this session.
