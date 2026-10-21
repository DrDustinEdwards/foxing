import type { ReaderSettings } from '@/components/reader/foliate-reader-webview'
import type { Locator, Preferences } from 'react-native-readium'

// Soften a 6-digit hex color to an 8-digit one with ~20% alpha so the
// popular-highlight tint sits behind text instead of competing with
// it. Pass-through for inputs we can't parse.
export function toSoftTint(hex: string): string {
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex + '33'
  if (/^#[0-9a-f]{8}$/i.test(hex)) return hex
  return hex
}

// Same regex the TtsBar uses to split chapter text into utterances. Keep
// these two in sync so highlightSentence(index) lines up with the index
// the bar reports.
export function splitSentences(chapterText: string): string[] {
  const parts =
    (chapterText ?? '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["')\]]*\s*/g) ?? []
  return parts.map((s) => s.trim()).filter((s) => s.length > 0)
}

const READIUM_BG_TO_THEME: Array<[RegExp, 'light' | 'dark' | 'sepia']> = [
  [/^#0/i, 'dark'],
  [/^#1/i, 'dark'],
  [/e8|f4|f5/i, 'sepia'],
]

function deriveReadiumTheme(bg: string): 'light' | 'dark' | 'sepia' {
  const lower = bg.toLowerCase()
  for (const [pattern, value] of READIUM_BG_TO_THEME) {
    if (pattern.test(lower)) return value
  }
  return 'light'
}

export function settingsToReadiumPreferences(s: ReaderSettings): Preferences {
  return {
    theme: deriveReadiumTheme(s.theme.background),
    fontSize: Math.max(0.5, Math.min(2.0, s.fontSize / 16)),
  }
}

// CFI <-> Locator conversion. Readium uses its own Locator shape; we keep
// the migration storage-compatible by stringifying the whole Locator and
// stashing it where progress_cfi used to live. Old foliate epubcfi(...)
// strings will fail to parse here and the reader will start from the top
// of the book on first open -- acceptable migration cost since there's no
// reliable epubcfi -> Readium Locator mapping.
export function decodeLocator(cfi: string | undefined): Locator | undefined {
  if (!cfi) return undefined
  if (!cfi.startsWith('{')) return undefined
  try {
    const parsed = JSON.parse(cfi) as Locator
    if (parsed && typeof parsed.href === 'string') return parsed
  } catch {
    return undefined
  }
  return undefined
}

export function encodeLocator(locator: Locator): string {
  return JSON.stringify(locator)
}
