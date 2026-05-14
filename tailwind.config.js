/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      // Each entry must match the exact React Native family name registered
      // by useFonts(). Expo Google Fonts uses `<Family>_<weight><weightName>[_Italic]`.
      // RN does not promote fontWeight to a heavier file — pick the family that
      // already encodes the weight you want.
      fontFamily: {
        display: ["Fraunces_600SemiBold"],
        "display-light": ["Fraunces_300Light"],
        "display-bold": ["Fraunces_700Bold"],
        "display-italic": ["Fraunces_600SemiBold_Italic"],
        "display-light-italic": ["Fraunces_300Light_Italic"],
        "display-bold-italic": ["Fraunces_700Bold_Italic"],

        body: ["SourceSerif4_400Regular"],
        "body-light": ["SourceSerif4_300Light"],
        "body-semibold": ["SourceSerif4_600SemiBold"],
        "body-italic": ["SourceSerif4_400Regular_Italic"],

        ui: ["DMSans_400Regular"],
        "ui-medium": ["DMSans_500Medium"],

        mono: ["DMMono_400Regular"],
        "mono-medium": ["DMMono_500Medium"],
      },
      colors: {
        // Brand
        "brand-ui": { light: "#D4622E", dark: "#E07840", DEFAULT: "#D4622E" },
        "brand-text": { light: "#B04A1C", dark: "#E07840", DEFAULT: "#B04A1C" },
        "brand-hover": { light: "#8A3610", dark: "#E88F58", DEFAULT: "#8A3610" },
        "brand-secondary": { light: "#F5A623", dark: "#F79C40", DEFAULT: "#F5A623" },
        "brand-subtle": { light: "#FAE0D6", dark: "#2E1C0E", DEFAULT: "#FAE0D6" },
        "brand-subtle-text": { light: "#632507", dark: "#F0A070", DEFAULT: "#632507" },

        // Backgrounds
        "bg-base": { light: "#FAF6EE", dark: "#16100B", DEFAULT: "#FAF6EE" },
        "bg-surface": { light: "#FFFFFF", dark: "#1F1710", DEFAULT: "#FFFFFF" },
        "bg-elevated": { light: "#FFFFFF", dark: "#2A1F16", DEFAULT: "#FFFFFF" },
        "bg-sunken": { light: "#F2EAD8", dark: "#100D08", DEFAULT: "#F2EAD8" },
        "bg-hover": { light: "#E5D8BF", dark: "#261C13", DEFAULT: "#E5D8BF" },
        "bg-selected": { light: "#FAE0D6", dark: "#3A2418", DEFAULT: "#FAE0D6" },
        "bg-disabled": { light: "#EDE6DC", dark: "#1E1810", DEFAULT: "#EDE6DC" },
        "bg-reading": { light: "#FEFCF8", dark: "#1A1410", DEFAULT: "#FEFCF8" },
        "bg-reading-sepia": { light: "#F5EDDA", dark: "#1E190E", DEFAULT: "#F5EDDA" },
        "bg-reading-oled": { light: "#000000", dark: "#000000", DEFAULT: "#000000" },

        // Text
        "text-primary": { light: "#16100B", dark: "#F5EDDE", DEFAULT: "#16100B" },
        "text-secondary": { light: "#3E3028", dark: "#C4AE96", DEFAULT: "#3E3028" },
        "text-tertiary": { light: "#815E41", dark: "#A28269", DEFAULT: "#815E41" },
        "text-disabled": { light: "#CFC7BC", dark: "#4A3628", DEFAULT: "#CFC7BC" },
        "text-on-brand": { light: "#FFFFFF", dark: "#FFFFFF", DEFAULT: "#FFFFFF" },
        "text-on-amber": { light: "#16100B", dark: "#16100B", DEFAULT: "#16100B" },
        "text-on-dark": { light: "#F5EDDE", dark: "#F5EDDE", DEFAULT: "#F5EDDE" },
        "text-on-sepia": { light: "#2A1E12", dark: "#2A1E12", DEFAULT: "#2A1E12" },

        // Status — success
        success: { light: "#2B6443", dark: "#72CA9A", DEFAULT: "#2B6443" },
        "success-bg": { light: "#EEF5EF", dark: "#0D2018", DEFAULT: "#EEF5EF" },
        "success-border": { light: "#D2E9D8", dark: "#72CA9A", DEFAULT: "#D2E9D8" },
        "success-border-interactive": { light: "#196639", dark: "#72CA9A", DEFAULT: "#196639" },

        // Status — warning
        warning: { light: "#605206", dark: "#F3DA49", DEFAULT: "#605206" },
        "warning-bg": { light: "#FCF5CF", dark: "#221C00", DEFAULT: "#FCF5CF" },
        "warning-border": { light: "#E8DC80", dark: "#F3DA49", DEFAULT: "#E8DC80" },
        "warning-border-interactive": { light: "#665B19", dark: "#F3DA49", DEFAULT: "#665B19" },

        // Status — error
        error: { light: "#8D253F", dark: "#E46872", DEFAULT: "#8D253F" },
        "error-bg": { light: "#FAF0F3", dark: "#220A0E", DEFAULT: "#FAF0F3" },
        "error-border": { light: "#F5D5DF", dark: "#E46872", DEFAULT: "#F5D5DF" },
        "error-border-interactive": { light: "#66192D", dark: "#E46872", DEFAULT: "#66192D" },

        // Status — info
        info: { light: "#2B6391", dark: "#70A6DB", DEFAULT: "#2B6391" },
        "info-bg": { light: "#EEF3F8", dark: "#091220", DEFAULT: "#EEF3F8" },
        "info-border": { light: "#D5E4F2", dark: "#70A6DB", DEFAULT: "#D5E4F2" },
        "info-border-interactive": { light: "#194466", dark: "#70A6DB", DEFAULT: "#194466" },

        // Borders
        "border-subtle": { light: "#E5D8BF", dark: "#261C13", DEFAULT: "#E5D8BF" },
        "border-default": { light: "#CFC7BC", dark: "#3A2C22", DEFAULT: "#CFC7BC" },
        "border-interactive": { light: "#7A4329", dark: "#BE7A37", DEFAULT: "#7A4329" },
        "border-strong": { light: "#815E41", dark: "#6A5040", DEFAULT: "#815E41" },
        "border-brand": { light: "#E58D6D", dark: "#E07840", DEFAULT: "#E58D6D" },
        "border-focus": { light: "#B04A1C", dark: "#F5B840", DEFAULT: "#B04A1C" },

        // Annotation highlights — backgrounds
        "hl-amber": { light: "#FEF0C0", dark: "#2E2008", DEFAULT: "#FEF0C0" },
        "hl-auburn": { light: "#FAD8C8", dark: "#2E1808", DEFAULT: "#FAD8C8" },
        "hl-yellow": { light: "#FAF3C6", dark: "#3D360B", DEFAULT: "#FAF3C6" },
        "hl-sage": { light: "#C8EDD5", dark: "#0A1E12", DEFAULT: "#C8EDD5" },
        "hl-cobalt": { light: "#C8DFEF", dark: "#081018", DEFAULT: "#C8DFEF" },
        "hl-crimson": { light: "#F5D0DC", dark: "#20080E", DEFAULT: "#F5D0DC" },
        "hl-purple": { light: "#DFD3EE", dark: "#231532", DEFAULT: "#DFD3EE" },

        // Annotation highlights — text
        "hl-amber-t": { light: "#5C3A00", dark: "#F5C060", DEFAULT: "#5C3A00" },
        "hl-auburn-t": { light: "#5A1E08", dark: "#F0A070", DEFAULT: "#5A1E08" },
        "hl-yellow-t": { light: "#554B07", dark: "#F4E47B", DEFAULT: "#554B07" },
        "hl-sage-t": { light: "#133520", dark: "#72CA9A", DEFAULT: "#133520" },
        "hl-cobalt-t": { light: "#133656", dark: "#70A6DB", DEFAULT: "#133656" },
        "hl-crimson-t": { light: "#4F1223", dark: "#E46872", DEFAULT: "#4F1223" },
        "hl-purple-t": { light: "#361C54", dark: "#B58DE2", DEFAULT: "#361C54" },

        // UI states
        "skeleton-base": { light: "#EDE6DC", dark: "#261C13", DEFAULT: "#EDE6DC" },
        "skeleton-shimmer": { light: "#F5EFE6", dark: "#3A2C22", DEFAULT: "#F5EFE6" },
        "tooltip-bg": { light: "#261E17", dark: "#F5EDDE", DEFAULT: "#261E17" },
        "tooltip-text": { light: "#F5EDDE", dark: "#16100B", DEFAULT: "#F5EDDE" },
        "comment-bg": { light: "#EEF3F8", dark: "#0C1420", DEFAULT: "#EEF3F8" },
        "comment-border": { light: "#D5E4F2", dark: "#1A3050", DEFAULT: "#D5E4F2" },
        "spoiler-bg": { light: "#3E3028", dark: "#C4AE96", DEFAULT: "#3E3028" },
        "spoiler-text": { light: "#3E3028", dark: "#C4AE96", DEFAULT: "#3E3028" },
        "drag-target": { light: "#FAE0D6", dark: "#3A2418", DEFAULT: "#FAE0D6" },
        "drag-border": { light: "#D4622E", dark: "#E07840", DEFAULT: "#D4622E" },
        "lookup-glow": { light: "#FAC455", dark: "#3A2C00", DEFAULT: "#FAC455" },
        "presence-online": { light: "#1F7A4A", dark: "#4CAF7D", DEFAULT: "#1F7A4A" },
        "presence-away": { light: "#8A5B0F", dark: "#F5B840", DEFAULT: "#8A5B0F" },

        // Section backgrounds
        "section-cream": "#FAF6EE",
        "section-auburn": "#D4622E",
        "section-deep-auburn": "#8A3610",
        "section-charcoal": "#16100B",
        "section-amber": "#F5A623",
        "section-sage": "#2B6443",
      },
    },
  },
  plugins: [],
}
