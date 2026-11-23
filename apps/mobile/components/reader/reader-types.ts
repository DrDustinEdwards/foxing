import type { HighlightColor } from "@/components/reader/floating-pill";

interface ReaderTheme {
  background: string;
  text: string;
}

export interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  theme: ReaderTheme;
  // Optional extended controls, host can omit; bridge applies defaults.
  fontFamily?: string;
  bold?: boolean;
  paragraphSpacing?: number;
  marginPx?: number;
  justify?: boolean;
  letterSpacingEm?: number;
  firstLineIndent?: boolean;
  dropCap?: boolean;
  warmScreen?: boolean;
  focusMode?: boolean;
}

export interface ReaderRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PassageCommentMarker {
  cfi: string;
  passageText: string;
}

export interface ReaderRef {
  prev: () => void;
  next: () => void;
  goTo: (cfi: string) => void;
  applySettings: (settings: ReaderSettings) => void;
  addHighlight: (cfi: string, color: HighlightColor) => void;
  // Push the active design-token palette so highlights match the pill swatches.
  setHighlightColors: (map: Record<HighlightColor, string>) => void;
  // Push the club passage comments so the reader can underline them. Empty list clears.
  setPassageComments: (comments: PassageCommentMarker[], colorHex?: string) => void;
  // Push popular highlight markers; the saved excerpt (text) builds a text-based Locator decoration.
  setPopularHighlights: (
    list: Array<{ text?: string; cfi: string; count: number }>,
    colorHex?: string,
  ) => void;
  startAutoScroll: (wpm: number) => void;
  stopAutoScroll: () => void;
  setColumns: (count: number) => void;
  // Async bridge, returns chapter plain text for TTS.
  getChapterText: () => Promise<string>;
  // Async bridge, returns chapter TOC items.
  getToc: () => Promise<Array<{ label: string; href: string; cfi: string | null }>>;
  // Navigate to a fraction of the publication (0..1). Readium's positions
  // list (cached from onPublicationReady) maps the fraction to the closest Locator.
  jumpToProgress: (fraction: number) => void;
  // Visually mark a sentence (1-based index within the current chapter)
  // for the TTS readback. Pass null to clear.
  highlightSentence: (index: number | null) => void;
}
