// Each weight is its own RN family name: RN does not synthesize bold, so the family string must carry the weight suffix or it falls back to the platform default.
//
export const Fonts = {
  display: "Fraunces_600SemiBold",
  displayLight: "Fraunces_300Light",
  displayBold: "Fraunces_700Bold",
  displayItalic: "Fraunces_600SemiBold_Italic",
  displayLightItalic: "Fraunces_300Light_Italic",
  displayBoldItalic: "Fraunces_700Bold_Italic",

  body: "SourceSerif4_400Regular",
  bodyLight: "SourceSerif4_300Light",
  bodySemibold: "SourceSerif4_600SemiBold",
  bodyItalic: "SourceSerif4_400Regular_Italic",

  ui: "DMSans_400Regular",
  uiMedium: "DMSans_500Medium",

  mono: "DMMono_400Regular",
  monoMedium: "DMMono_500Medium",
} as const;
