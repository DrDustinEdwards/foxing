import type { HighlightColor } from "@/components/reader/floating-pill";

interface ReaderTheme {
  background: string;
  text: string;
}

export interface ReaderSettings {
  fontSize: number;
  theme: ReaderTheme;
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
  setHighlightColors: (map: Record<HighlightColor, string>) => void;
  setPassageComments: (comments: PassageCommentMarker[], colorHex?: string) => void;
  setPopularHighlights: (
    list: Array<{ text?: string; cfi: string; count: number }>,
    colorHex?: string,
  ) => void;
  getChapterText: () => Promise<string>;
  getToc: () => Promise<Array<{ label: string; href: string; cfi: string | null }>>;
  jumpToProgress: (fraction: number) => void;
  highlightSentence: (index: number | null) => void;
}

export interface WordPillState {
  word: string;
  surroundingText: string;
  cfi: string | null;
}

export interface PassagePillState {
  text: string;
  cfi: string | null;
}
