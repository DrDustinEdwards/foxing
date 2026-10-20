# Mobile App Rules

Expo React Native reader. Expo SDK 56, New Architecture enabled,
RN 0.85.3. Reader runs react-native-readium 5.0.0-rc.17.

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

All AI calls go through the `ai-companion` Supabase Edge Function. Never
call the Anthropic API directly from the app -- the API key lives in the
Edge Function's Supabase vault, not the bundle.

Custom hooks for all data fetching. No `fetch` or Supabase queries inside
render bodies.

## Builds

EAS only -- Dustin watches the dashboard. Don't poll long-running cloud
builds from this session.
