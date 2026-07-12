// Pure reader-settings model + mapping to Readium EpubPreferences. Kept
// framework-free so it is unit-testable. Theme colors come straight from the
// design system's reading-canvas modes; typography values use Readium's units
// (fontSize is a fraction where 1.0 = 100%, lineHeight is unitless, pageGutter
// is px).
export type ReaderTheme = "light" | "sepia" | "dark";

export interface ReaderSettings {
  theme: ReaderTheme;
  fontSize: number; // fraction: 1.0 = 100%
  lineHeight: number; // unitless
  margin: number; // page gutter, px
  columns: 1 | 2;
  scroll: boolean;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: "light",
  fontSize: 1,
  lineHeight: 1.5,
  margin: 40,
  columns: 2,
  scroll: false,
};

export const FONT_SIZE_RANGE = { min: 0.7, max: 1.8, step: 0.1 } as const;
export const LINE_HEIGHT_RANGE = { min: 1.2, max: 2.2, step: 0.1 } as const;
export const MARGIN_RANGE = { min: 16, max: 96, step: 8 } as const;

/** Reading-canvas background/text per theme (design-system.md "Reading Canvas Modes"). */
export const READING_CANVAS: Record<ReaderTheme, { bg: string; text: string }> = {
  light: { bg: "#FEFCF8", text: "#16100B" },
  sepia: { bg: "#F5EDDA", text: "#2A1E12" },
  dark: { bg: "#1A1410", text: "#F5EDDE" },
};

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Readium EpubPreferences subset. Typography is applied post-load (never in the
 *  constructor) so an out-of-range value degrades gracefully instead of blocking
 *  the first render. */
export function toEpubPreferences(s: ReaderSettings): Record<string, unknown> {
  const canvas = READING_CANVAS[s.theme];
  return {
    scroll: s.scroll,
    columnCount: s.scroll ? 1 : s.columns,
    fontSize: clamp(s.fontSize, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max),
    lineHeight: clamp(s.lineHeight, LINE_HEIGHT_RANGE.min, LINE_HEIGHT_RANGE.max),
    pageGutter: clamp(s.margin, MARGIN_RANGE.min, MARGIN_RANGE.max),
    backgroundColor: canvas.bg,
    textColor: canvas.text,
  };
}

/** Minimal, guaranteed-safe preferences for the initial navigator construction
 *  (only the fields the spike proved safe). */
export function initialEpubPreferences(s: ReaderSettings): Record<string, unknown> {
  return { scroll: s.scroll, columnCount: s.scroll ? 1 : s.columns };
}
