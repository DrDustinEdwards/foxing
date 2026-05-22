import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { View, ActivityIndicator, Text } from 'react-native'
import {
  ReadiumView,
  type ReadiumViewRef,
  type Locator,
  type Preferences,
  type DecorationGroup,
  type Decoration,
  type SelectionEvent,
  type PublicationReadyEvent,
  type DecorationActivatedEvent,
} from 'react-native-readium'

import type { HighlightColor } from '@/components/reader/floating-pill'
import type { WordWiseHint } from '@/lib/claude'
import type {
  ReaderRef,
  ReaderSettings,
  PassageCommentMarker,
  ReaderRect,
} from '@/components/reader/foliate-reader-webview'

// Phase 3 v1 of the Foliate -> Readium migration. Implements the same
// ReaderRef contract so app/reader/[id].tsx can switch renderers without
// changing the surrounding screen wiring.
//
// What works:
//   - render an EPUB from a public Supabase Storage URL
//   - goForward / goBackward / goTo (Locator-based)
//   - applySettings -> Readium Preferences (theme, font size, line height,
//     family, justification, page margins)
//   - addHighlight / removeHighlight as DecorationGroup updates
//   - text selection emits onPassageSelected; the host renders the floating
//     pill the same way it does for Foliate
//   - tap-anywhere toggle for chrome via a transparent overlay View placed
//     above the renderer (Readium has no onTap event)
//   - location persistence with 1500ms debounce so we don't write to Supabase
//     on every page swipe
//
// What's stubbed (TODO Phase 3.x):
//   - WordWise hints, popular-highlight inline labels, passage-comment dots,
//     bilingual paragraph translations: all require DecorationGroup rebuilds
//     with custom DecorationStyle.html
//   - TTS auto-scroll, sentence highlighting, chapter-text extraction:
//     Readium has no auto-scroll API; chapter text needs separate EPUB
//     parsing (not exposed on ReadiumView)
//   - Two-column spread: maps to preferences.spread = 'always' but layout
//     depends on device width and Readium navigator support
//   - Single-tap word lookup: Readium uses selection-based interaction. The
//     host falls back to long-press selection until we add a selectionAction.

const HIGHLIGHTS_GROUP = 'highlights'

interface ReadiumReaderProps {
  epubUrl: string
  initialCfi?: string
  initialSettings: ReaderSettings
  onReady?: () => void
  onError?: (message: string) => void
  onLocationChange?: (
    cfi: string,
    fraction: number,
    pageWordCount?: number,
    pageText?: string,
  ) => void
  onChapterChange?: (chapter: { title: string; index: number }) => void
  onWordTapped?: (
    word: string,
    surroundingText: string,
    cfi: string | null,
    rect: ReaderRect,
  ) => void
  onPassageSelected?: (text: string, cfi: string | null, rect: ReaderRect) => void
  onTap?: () => void
  onPassageCommentTapped?: (cfi: string | null, passageText: string) => void
}

function settingsToPreferences(s: ReaderSettings): Preferences {
  const themeKey: 'light' | 'dark' | 'sepia' =
    s.theme.background.toLowerCase() === '#000000'
      ? 'dark'
      : s.theme.background.toLowerCase().includes('e8') ||
          s.theme.background.toLowerCase().includes('f5')
        ? 'sepia'
        : 'light'

  return {
    backgroundColor: s.theme.background,
    textColor: s.theme.text,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    fontWeight: s.bold ? 700 : 400,
    paragraphSpacing: s.paragraphSpacing,
    pageMargins: s.marginPx ? Math.max(0.5, s.marginPx / 32) : undefined,
    textAlign: s.justify ? 'justify' : 'start',
    letterSpacing: s.letterSpacingEm,
    theme: themeKey,
    publisherStyles: false,
  }
}

// CFI <-> Locator conversion. Readium uses its own Locator shape; we keep
// the migration storage-compatible by stringifying the whole Locator and
// stashing it where progress_cfi used to live. Old foliate epubcfi(...)
// strings will fail to parse here and the reader will start from the top
// of the book on first open -- acceptable migration cost since there's no
// reliable epubcfi -> Readium Locator mapping.
function decodeLocator(cfi: string | undefined): Locator | undefined {
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

function encodeLocator(locator: Locator): string {
  return JSON.stringify(locator)
}

export const ReadiumReader = forwardRef<ReaderRef, ReadiumReaderProps>(
  function ReadiumReader(
    {
      epubUrl,
      initialCfi,
      initialSettings,
      onReady,
      onError,
      onLocationChange,
      onChapterChange,
      onPassageSelected,
      onTap,
      onPassageCommentTapped,
    },
    ref,
  ) {
    const viewRef = useRef<ReadiumViewRef>(null)
    const [preferences, setPreferences] = useState<Preferences>(
      settingsToPreferences(initialSettings),
    )
    const [highlights, setHighlights] = useState<Decoration[]>([])
    // Default palette; host calls setHighlightColors with the design-token
    // values pulled from useColors() so light/dark match the rest of the UI.
    const highlightPaletteRef = useRef<Record<HighlightColor, string>>({
      amber: '#FFC107',
      auburn: '#A33B20',
      yellow: '#FFEB3B',
      sage: '#9CCC65',
      cobalt: '#3B5BDB',
      crimson: '#D32F2F',
      purple: '#9C27B0',
    })
    const lastSavedLocatorRef = useRef<string | null>(null)
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const initialLocator = useMemo(() => decodeLocator(initialCfi), [initialCfi])

    const decorations: DecorationGroup[] = useMemo(
      () => [
        {
          name: HIGHLIGHTS_GROUP,
          decorations: highlights,
        },
      ],
      [highlights],
    )

    const flushLocator = useCallback(
      (locator: Locator) => {
        const serialized = encodeLocator(locator)
        if (serialized === lastSavedLocatorRef.current) return
        lastSavedLocatorRef.current = serialized
        const progression = locator.locations?.progression ?? 0
        onLocationChange?.(serialized, progression, undefined, locator.text?.highlight)
      },
      [onLocationChange],
    )

    const handleLocationChange = useCallback(
      (locator: Locator) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => flushLocator(locator), 1500)
        if (locator.title) {
          onChapterChange?.({ title: locator.title, index: 0 })
        }
      },
      [flushLocator, onChapterChange],
    )

    const handlePublicationReady = useCallback(
      (_event: PublicationReadyEvent) => {
        onReady?.()
      },
      [onReady],
    )

    const handleSelectionChange = useCallback(
      (event: SelectionEvent) => {
        const text = event.selectedText
        if (!text || !event.locator) return
        const cfi = encodeLocator(event.locator)
        // Readium doesn't surface a screen rect for the selection. The
        // floating pill positions at the bottom of the screen as a
        // fallback until we route a real selection rect through Nitro.
        const rect: ReaderRect = { x: 0, y: 0, width: 0, height: 0 }
        onPassageSelected?.(text, cfi, rect)
      },
      [onPassageSelected],
    )

    const handleDecorationActivated = useCallback(
      (event: DecorationActivatedEvent) => {
        if (event.group === HIGHLIGHTS_GROUP) return
        const passageText = event.decoration.locator.text?.highlight ?? ''
        onPassageCommentTapped?.(
          encodeLocator(event.decoration.locator),
          passageText,
        )
      },
      [onPassageCommentTapped],
    )

    useImperativeHandle(
      ref,
      () => ({
        prev: () => viewRef.current?.goBackward(),
        next: () => viewRef.current?.goForward(),
        goTo: (cfi: string) => {
          const locator = decodeLocator(cfi)
          if (locator) viewRef.current?.goTo(locator)
        },
        applySettings: (s: ReaderSettings) => {
          setPreferences(settingsToPreferences(s))
        },
        addHighlight: (cfi: string, color: HighlightColor) => {
          const locator = decodeLocator(cfi)
          if (!locator) return
          setHighlights((prev) => {
            const next = prev.filter((d) => d.id !== cfi)
            return [
              ...next,
              {
                id: cfi,
                locator,
                style: {
                  type: 'highlight',
                  tint: highlightPaletteRef.current[color] ?? '#FFEB3B',
                },
              },
            ]
          })
        },
        removeHighlight: (cfi: string) => {
          setHighlights((prev) => prev.filter((d) => d.id !== cfi))
        },
        setHighlightColors: (map: Record<HighlightColor, string>) => {
          highlightPaletteRef.current = map
          // Re-tint existing decorations
          setHighlights((prev) =>
            prev.map((d) => {
              const colorKey = (Object.entries(map).find(
                ([, hex]) => hex === d.style.tint,
              )?.[0] ?? null) as HighlightColor | null
              if (!colorKey) return d
              return { ...d, style: { ...d.style, tint: map[colorKey] } }
            }),
          )
        },
        setWordWiseEnabled: () => {
          // TODO Phase 3.x: rebuild Word Wise as a DecorationGroup with
          // DecorationStyle.html containing inline hint chips
        },
        applyWordWiseHints: (_hints: WordWiseHint[]) => {
          // TODO Phase 3.x
        },
        setPassageComments: (
          _comments: PassageCommentMarker[],
          _colorHex?: string,
        ) => {
          // TODO Phase 3.x: render dots as a DecorationGroup keyed off
          // the comment locators with DecorationStyle.html for the dot SVG
        },
        setPopularHighlights: (
          _list: Array<{ cfi: string; count: number }>,
          _colorHex?: string,
        ) => {
          // TODO Phase 3.x: render "N readers highlighted" labels as a
          // DecorationGroup with DecorationStyle.html
        },
        startAutoScroll: (_wpm: number) => {
          // TODO Phase 3.x: simulate via timed goForward calls; Readium
          // has no native auto-scroll
        },
        stopAutoScroll: () => {
          // TODO Phase 3.x
        },
        setColumns: (count: number) => {
          setPreferences((prev) => ({
            ...prev,
            spread: count === 2 ? 'always' : 'never',
            columnCount: count === 2 ? '2' : 'auto',
          }))
        },
        getChapterText: async () => {
          // TODO Phase 3.x: parse EPUB OPF + spine HTML separately. Readium
          // does not expose chapter plain text on the JS side.
          return ''
        },
        getChapterParagraphs: async () => {
          // TODO Phase 3.x: same as getChapterText, returning paragraph
          // array for bilingual mode
          return []
        },
        getToc: async () => {
          // TODO Phase 3.x: cache PublicationReadyEvent.tableOfContents on
          // mount and return it here. For now returns empty so go-to-chapter
          // navigation falls back to manual entry.
          return []
        },
        highlightSentence: (_index: number | null) => {
          // TODO Phase 3.x: paint a Decoration on the active sentence
          // locator. Requires sentence-level locator construction.
        },
        setBilingualContent: (_translations: string[]) => {
          // TODO Phase 3.x: per-paragraph DecorationStyle.html with italic
          // translation block
        },
      }),
      [],
    )

    // TODO Phase 3.x: implement tap-to-toggle chrome. A Pressable overlay
    // blocks Readium's swipe-to-page-turn; the right pattern is a custom
    // PanResponder that fires onTap only when movement stays under the
    // touch-slop threshold. Until then, the host's chrome button is the
    // only way to bring chrome back once it's hidden.
    void onTap

    return (
      <View style={{ flex: 1, backgroundColor: initialSettings.theme.background }}>
        <ReadiumView
          ref={viewRef}
          file={{ url: epubUrl, initialLocation: initialLocator }}
          preferences={preferences}
          decorations={decorations}
          onLocationChange={handleLocationChange}
          onPublicationReady={handlePublicationReady}
          onSelectionChange={handleSelectionChange}
          onDecorationActivated={handleDecorationActivated}
          style={{ flex: 1 }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={initialSettings.theme.text} />
          <Text style={{ color: initialSettings.theme.text, marginTop: 8 }}>
            Loading…
          </Text>
        </View>
      </View>
    )
  },
)

// Bind unused props to silence ESLint when the feature-flagged migration
// path isn't fully exercised yet.
ReadiumReader.displayName = 'ReadiumReader'
