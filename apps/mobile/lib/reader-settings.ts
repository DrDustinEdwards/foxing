// Reader settings: shape, persistence, and presets. Owned by the host
// (React Native side); the Foliate bridge consumes them via applyTheme()
// so changes here flow through one apply() call to the WebView.

import AsyncStorage from '@react-native-async-storage/async-storage'

export type CanvasTheme = 'default' | 'sepia' | 'dark' | 'oled'
export type FontFamilyKey = 'foxing' | 'classic' | 'dyslexic' | 'modern'
export type FontSizeStep = 'xs' | 's' | 'm' | 'l' | 'xl' | '2xl' | '3xl'
export type LineSpacingStep = 'tight' | 'normal' | 'relaxed' | 'spacious'
export type LetterSpacingStep = 'tight' | 'normal' | 'wide'
export type MarginWidthStep = 'narrow' | 'normal' | 'wide' | 'extra-wide'
export type ParagraphSpacingStep = 'compact' | 'normal' | 'spacious'
export type FlowMode = 'paginated' | 'scrolled'
export type ColumnMode = 'single' | 'two'
export type AlignmentMode = 'justified' | 'left'
export type RulerStyle = 'highlight' | 'block-rest'
export type RulerColor = 'amber' | 'cream' | 'charcoal'
export type PageAnim = 'none' | 'slide' | 'fade'

export interface ReaderPrefs {
  // Font tab
  fontSize: FontSizeStep
  fontFamily: FontFamilyKey
  bold: boolean
  lineSpacing: LineSpacingStep
  letterSpacing: LetterSpacingStep
  firstLineIndent: boolean
  dropCap: boolean
  // Layout tab
  marginWidth: MarginWidthStep
  alignment: AlignmentMode
  paragraphSpacing: ParagraphSpacingStep
  flowMode: FlowMode
  columnMode: ColumnMode
  // Canvas tab
  canvasTheme: CanvasTheme
  rulerEnabled: boolean
  rulerColor: RulerColor
  rulerStyle: RulerStyle
  wordWiseEnabled: boolean
  popularHighlightsEnabled: boolean
  pageAnim: PageAnim
  // Phase D additions, canvas/comfort toggles
  warmScreen: boolean
  focusMode: boolean
  autoScroll: boolean
  autoScrollWpm: number
  // Phase I, language learning
  bilingualMode: boolean
  targetLanguage: string
  grammarMode: boolean
}

export const DEFAULT_PREFS: ReaderPrefs = {
  fontSize: 'm',
  fontFamily: 'foxing',
  bold: false,
  lineSpacing: 'normal',
  letterSpacing: 'normal',
  firstLineIndent: false,
  dropCap: false,
  marginWidth: 'normal',
  alignment: 'justified',
  paragraphSpacing: 'normal',
  flowMode: 'paginated',
  columnMode: 'single',
  canvasTheme: 'dark',
  rulerEnabled: false,
  rulerColor: 'amber',
  rulerStyle: 'highlight',
  wordWiseEnabled: false,
  popularHighlightsEnabled: false,
  pageAnim: 'slide',
  warmScreen: false,
  focusMode: false,
  autoScroll: false,
  autoScrollWpm: 220,
  bilingualMode: false,
  targetLanguage: 'Spanish',
  grammarMode: false,
}

export const LETTER_SPACING_EM: Record<LetterSpacingStep, number> = {
  tight: -0.01,
  normal: 0,
  wide: 0.05,
}

// Resolved units used by the Foliate WebView. Steps map to concrete
// pixel/multiplier values here, the host stays in step-space so the UI
// can present friendly labels.
export const FONT_SIZE_PX: Record<FontSizeStep, number> = {
  xs: 14, s: 16, m: 18, l: 20, xl: 22, '2xl': 26, '3xl': 30,
}
export const LINE_SPACING_VAL: Record<LineSpacingStep, number> = {
  tight: 1.4, normal: 1.7, relaxed: 1.9, spacious: 2.2,
}
export const MARGIN_PX: Record<MarginWidthStep, number> = {
  narrow: 8, normal: 16, wide: 28, 'extra-wide': 44,
}
export const PARAGRAPH_SPACING_EM: Record<ParagraphSpacingStep, number> = {
  compact: 0.3, normal: 0.7, spacious: 1.2,
}

export const FONT_FAMILY_CSS: Record<FontFamilyKey, string> = {
  foxing: '"Source Serif 4", "SourceSerif4_400Regular", Georgia, serif',
  classic: 'Georgia, serif',
  // OpenDyslexic isn't bundled, fall through to system serif. The label
  // is still shown in the picker so we can ship the font later without
  // changing the picker UI.
  dyslexic: 'OpenDyslexic, "Comic Sans MS", system-ui, sans-serif',
  modern: 'system-ui, -apple-system, "DMSans_400Regular", sans-serif',
}

const STORAGE_PREFIX = 'foxing.reader-prefs.'

function key(userId: string | null): string {
  return `${STORAGE_PREFIX}${userId ?? 'anon'}`
}

export async function loadPrefs(userId: string | null): Promise<ReaderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(key(userId))
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>
    // Merge so newly-added prefs adopt their default value rather than
    // becoming undefined for existing users.
    return { ...DEFAULT_PREFS, ...parsed }
  } catch {
    return DEFAULT_PREFS
  }
}

export async function savePrefs(userId: string | null, prefs: ReaderPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(prefs))
  } catch (e) {
    console.warn('[reader-settings] save failed:', e)
  }
}

// ── Saved themes (custom + presets) ────────────────────────────────────

export interface SavedTheme {
  id: string
  name: string
  prefs: ReaderPrefs
  isPreset?: boolean
}

const SAVED_KEY_PREFIX = 'foxing.reader-themes.'

export const PRESET_THEMES: SavedTheme[] = [
  {
    id: 'preset-compact',
    name: 'Compact',
    isPreset: true,
    prefs: {
      ...DEFAULT_PREFS,
      fontSize: 's',
      lineSpacing: 'tight',
      marginWidth: 'narrow',
      paragraphSpacing: 'compact',
    },
  },
  {
    id: 'preset-standard',
    name: 'Standard',
    isPreset: true,
    prefs: { ...DEFAULT_PREFS },
  },
  {
    id: 'preset-large',
    name: 'Large',
    isPreset: true,
    prefs: {
      ...DEFAULT_PREFS,
      fontSize: 'xl',
      lineSpacing: 'relaxed',
      marginWidth: 'wide',
    },
  },
  {
    id: 'preset-low-vision',
    name: 'Low Vision',
    isPreset: true,
    prefs: {
      ...DEFAULT_PREFS,
      fontSize: '3xl',
      bold: true,
      lineSpacing: 'spacious',
      marginWidth: 'wide',
      paragraphSpacing: 'spacious',
    },
  },
]

export async function loadSavedThemes(userId: string | null): Promise<SavedTheme[]> {
  try {
    const raw = await AsyncStorage.getItem(`${SAVED_KEY_PREFIX}${userId ?? 'anon'}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedTheme[]
    return Array.isArray(parsed) ? parsed.slice(0, 5) : []
  } catch { return [] }
}

export async function saveCustomTheme(userId: string | null, theme: SavedTheme): Promise<void> {
  const existing = await loadSavedThemes(userId)
  const next = [theme, ...existing.filter((t) => t.id !== theme.id)].slice(0, 5)
  await AsyncStorage.setItem(`${SAVED_KEY_PREFIX}${userId ?? 'anon'}`, JSON.stringify(next))
}
