import { Platform } from 'react-native'

// Each weight Expo Google Fonts ships is registered under its own
// React Native font family name. RN does not synthesize bold from a single
// fontFamily — the family string must include the weight suffix or the
// renderer silently falls back to the platform default.
//
// Roles map to the design-system tiers:
//   display → Fraunces (headings, hero, pull quotes)
//   body    → Source Serif 4 (reading canvas, editorial copy)
//   ui      → DM Sans (buttons, nav, labels, inputs, badges)
//   mono    → DM Mono (timestamps, hex values, code)
export const Fonts = {
  display: 'Fraunces_600SemiBold',
  displayLight: 'Fraunces_300Light',
  displayBold: 'Fraunces_700Bold',
  displayItalic: 'Fraunces_600SemiBold_Italic',
  displayLightItalic: 'Fraunces_300Light_Italic',
  displayBoldItalic: 'Fraunces_700Bold_Italic',

  body: 'SourceSerif4_400Regular',
  bodyLight: 'SourceSerif4_300Light',
  bodySemibold: 'SourceSerif4_600SemiBold',
  bodyItalic: 'SourceSerif4_400Regular_Italic',

  ui: 'DMSans_400Regular',
  uiMedium: 'DMSans_500Medium',

  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const

const serifFallback = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' })!
const sansFallback = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' })!
const monoFallback = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })!

export const FontFallbacks = {
  display: serifFallback,
  body: serifFallback,
  ui: sansFallback,
  mono: monoFallback,
} as const

export type FontRole = keyof typeof Fonts
