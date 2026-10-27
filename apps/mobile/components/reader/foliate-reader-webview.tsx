import type { HighlightColor } from '@/components/reader/floating-pill'

// Callback shape mirrors the old ReaderWebView so the reader screen wiring
// stays simple. Position info on word/passage callbacks lets the host
// render a FloatingPill anchored to the actual on-screen word.

interface ReaderTheme {
  background: string
  text: string
}

export interface ReaderSettings {
  fontSize: number
  lineHeight: number
  theme: ReaderTheme
  // Optional extended controls, host can omit; bridge applies defaults.
  fontFamily?: string
  bold?: boolean
  paragraphSpacing?: number
  marginPx?: number
  justify?: boolean
  // Phase D additions
  letterSpacingEm?: number
  firstLineIndent?: boolean
  dropCap?: boolean
  warmScreen?: boolean
  focusMode?: boolean
}

export interface ReaderRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PassageCommentMarker {
  cfi: string
  passageText: string
}

export interface ReaderRef {
  prev: () => void
  next: () => void
  // Optional hint lets callers carry an excerpt + chapter name forward
  // when the CFI is in a renderer-foreign format (e.g. legacy foliate
  // epubcfi strings being navigated by the Readium renderer). The Foliate
  // renderer ignores the hint and uses the CFI directly.
  goTo: (
    cfi: string,
    hint?: { text?: string; chapter?: string },
  ) => void
  applySettings: (settings: ReaderSettings) => void
  addHighlight: (cfi: string, color: HighlightColor) => void
  removeHighlight: (cfi: string) => void
  // Push the active design-token palette into the WebView so the highlight
  // rects rendered by foliate-view match the swatches shown in the pill.
  setHighlightColors: (map: Record<HighlightColor, string>) => void
  // Push the set of club passage comments into the reader so it can paint
  // margin dots next to commented paragraphs. Empty list clears all dots.
  setPassageComments: (comments: PassageCommentMarker[], colorHex?: string) => void
  // Push popular highlight markers. The legacy Foliate path used cfi to
  // anchor an inline label; the Readium path uses the saved excerpt
  // (text) to build a text-based Locator decoration. The shape is
  // widened to accept both fields so a single call site works with
  // either renderer.
  setPopularHighlights: (
    list: Array<{ text?: string; cfi: string; count: number }>,
    colorHex?: string,
  ) => void
  // Phase D additions
  startAutoScroll: (wpm: number) => void
  stopAutoScroll: () => void
  // Layout: 1 (default) or 2 (dual-page spread). The renderer reapplies
  // pagination using the same CFI so the user's position is preserved.
  setColumns: (count: number) => void
  // Async bridge, returns chapter plain text for TTS.
  getChapterText: () => Promise<string>
  // Async bridge, returns one entry per paragraph in the visible chapter.
  // Used to drive bilingual-mode translation fetching.
  getChapterParagraphs: () => Promise<string[]>
  // Async bridge, returns chapter TOC items.
  getToc: () => Promise<Array<{ label: string; href: string; cfi: string | null }>>
  // Navigate to a fraction of the publication (0..1). Readium's positions
  // list (cached on the wrapper from onPublicationReady) is used to map
  // the fraction to the closest concrete Locator. Foliate doesn't have
  // an equivalent; the contract is widened for Readium and left unused
  // on the Foliate path.
  jumpToProgress: (fraction: number) => void
  // Visually mark a sentence (1-based index within the current chapter)
  // for the TTS readback. Pass null to clear.
  highlightSentence: (index: number | null) => void
  // Append italic translations under each paragraph in the visible chapter.
  // Empty array clears any existing translations.
}
