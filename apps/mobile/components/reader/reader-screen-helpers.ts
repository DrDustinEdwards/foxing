import { type CanvasTheme, FONT_FAMILY_CSS, FONT_SIZE_PX, LETTER_SPACING_EM, LINE_SPACING_VAL, MARGIN_PX, PARAGRAPH_SPACING_EM, type ReaderPrefs } from '@/lib/reader-settings'
import { Colors } from '@/constants/colors'
import type { ReaderSettings } from '@/components/reader/foliate-reader-webview'

// Reading canvas modes are decoupled from the app's UI theme, they're
// applied to the WebView body (and via setStyles to each chapter iframe).
export const CANVAS_PALETTE: Record<CanvasTheme, { background: string; text: string }> = {
  default: { background: Colors.light.bgReading, text: Colors.light.textPrimary },
  sepia: { background: Colors.light.bgReadingSepia, text: Colors.light.textOnSepia },
  dark: { background: Colors.dark.bgReading, text: Colors.dark.textPrimary },
  oled: { background: Colors.dark.bgReadingOled, text: Colors.dark.textOnDark },
}

// "MM:SS" countdown formatter for the sleep-timer badge. Zero-pads seconds
// so the width doesn't jitter as the digit count changes.
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Convert a 6-digit hex like "#FEFCF8" to an rgba() string at the given
// alpha. Used so the chrome bar can be translucent without the React Native
// `opacity` prop (which would fade the icons inside too).
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const v = parseInt(m[1], 16)
  const r = (v >> 16) & 0xff
  const g = (v >> 8) & 0xff
  const b = v & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Project a ReaderPrefs (step-space, persistent) into the flat ReaderSettings
// the WebView consumes (concrete pixel/multiplier values). The isTablet flag
// scales margins up so text doesn't run edge-to-edge on iPad-class widths.
export function prefsToSettings(prefs: ReaderPrefs, isTablet: boolean): ReaderSettings {
  const palette = CANVAS_PALETTE[prefs.canvasTheme]
  const baseMargin = MARGIN_PX[prefs.marginWidth]
  return {
    fontSize: FONT_SIZE_PX[prefs.fontSize],
    lineHeight: LINE_SPACING_VAL[prefs.lineSpacing],
    theme: palette,
    fontFamily: FONT_FAMILY_CSS[prefs.fontFamily],
    bold: prefs.bold,
    paragraphSpacing: PARAGRAPH_SPACING_EM[prefs.paragraphSpacing],
    marginPx: isTablet ? Math.round(baseMargin * 1.5) : baseMargin,
    justify: prefs.alignment === 'justified',
    letterSpacingEm: LETTER_SPACING_EM[prefs.letterSpacing],
    firstLineIndent: prefs.firstLineIndent,
    dropCap: prefs.dropCap,
    warmScreen: prefs.warmScreen,
    focusMode: prefs.focusMode,
  }
}
