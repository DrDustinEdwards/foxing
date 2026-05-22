import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { View, useWindowDimensions } from 'react-native'
import { ensureEpubLocalUri } from '@/lib/epub-cache'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
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
import { getChapterContent } from '@/lib/epub-content'

// Foliate -> Readium reader migration. Implements the same ReaderRef
// contract so app/reader/[id].tsx can switch renderers without changing
// the surrounding screen wiring.
//
// What works:
//   - render an EPUB from a public Supabase Storage URL
//   - goForward / goBackward / goTo (Locator-based)
//   - applySettings -> Readium Preferences (theme, font size, line height,
//     family, justification, page margins)
//   - addHighlight / removeHighlight as DecorationGroup updates
//   - text selection: single-word -> onWordTapped with surrounding context,
//     multi-word -> onPassageSelected; both route through the floating pill
//   - tap-to-hide chrome via an RNGH Tap gesture with tight movement and
//     duration thresholds so swipes / long-press pass through to Readium
//   - location persistence with 1500ms debounce so we don't write to Supabase
//     on every page swipe (also fixes the historical CFI oscillation bug)
//   - getChapterText / getChapterParagraphs by parsing the EPUB in-process
//     via lib/epub-content (jszip + OPF parser + HTML stripper)
//   - getToc populated from Readium's onPublicationReady event
//   - highlightSentence(index) paints a text-based Locator decoration; the
//     Readium navigator matches the text against the rendered page
//
// What's stubbed (Phase 3.x follow-up):
//   - WordWise hints, popular-highlight inline labels, passage-comment dots,
//     bilingual paragraph translations: all require DecorationGroup rebuilds
//     with custom DecorationStyle.html
//   - Auto-scroll: Readium has no native API, would need to be simulated
//     with timed goForward calls + scroll-mode preferences

const HIGHLIGHTS_GROUP = 'highlights'
const TTS_SENTENCE_GROUP = 'tts-sentence'

// Same regex the TtsBar uses to split chapter text into utterances. Keep
// these two in sync so highlightSentence(index) lines up with the index
// the bar reports.
function splitSentences(chapterText: string): string[] {
  const parts =
    (chapterText ?? '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["')\]]*\s*/g) ?? []
  return parts.map((s) => s.trim()).filter((s) => s.length > 0)
}

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

// Preferences mapping is intentionally minimal. EpubPreferences's init
// block enforces range constraints (the original Foliate values crashed
// the navigator). Only two fields are wired so far:
//
//   theme     - mapped from Foliate's background color to the Readium
//               enum ('light' | 'dark' | 'sepia').
//   fontSize  - Readium treats fontSize as a SCALE FACTOR, not a pixel
//               value. We derive it as Foliate's px / 16 (approx
//               default body size) and clamp to a conservative range
//               of 0.5..2.0 so the EpubPreferences init's require()
//               never fires.
//
// Every other Foliate setting (lineHeight, paragraphSpacing, marginPx,
// letterSpacing, justify, etc.) stays unset until we map each one
// against a verified Readium range.

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

function settingsToReadiumPreferences(s: ReaderSettings): Preferences {
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
      onWordTapped,
      onPassageSelected,
      onTap,
      onPassageCommentTapped,
    },
    ref,
  ) {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions()
    const viewRef = useRef<ReadiumViewRef>(null)
    const [highlights, setHighlights] = useState<Decoration[]>([])
    const [sentenceDecoration, setSentenceDecoration] = useState<Decoration | null>(null)
    const [readiumPrefs, setReadiumPrefs] = useState<Preferences>(() =>
      settingsToReadiumPreferences(initialSettings),
    )
    // Local file URI for ReadiumView. Readium cannot open an HTTPS URL
    // directly -- the native side errors "File does not exist: https://..."
    // and silently leaves the publication in a loading state. We download
    // the EPUB up front and only mount ReadiumView once the local file is
    // ready.
    const [localUri, setLocalUri] = useState<string | null>(null)

    // Host callbacks are passed as inline lambdas, so their identity
    // changes on every parent render. Mirror them through refs so the
    // download effect, gesture, and safety timeout can read the latest
    // without depending on the callback as a useEffect/useCallback dep.
    // Without this, every host re-render (e.g. setProgress on page turn)
    // would cause the download effect to re-fire, reset localUri to null,
    // unmount ReadiumView, then remount with `initialLocation: initialCfi`,
    // which on a book with no saved position jumps back to chapter 1.
    const onReadyRef = useRef(onReady)
    const onErrorRef = useRef(onError)
    const onLocationChangeRef = useRef(onLocationChange)
    const onChapterChangeRef = useRef(onChapterChange)
    const onWordTappedRef = useRef(onWordTapped)
    const onPassageSelectedRef = useRef(onPassageSelected)
    const onPassageCommentTappedRef = useRef(onPassageCommentTapped)
    const onTapRef = useRef(onTap)
    onReadyRef.current = onReady
    onErrorRef.current = onError
    onLocationChangeRef.current = onLocationChange
    onChapterChangeRef.current = onChapterChange
    onWordTappedRef.current = onWordTapped
    onPassageSelectedRef.current = onPassageSelected
    onPassageCommentTappedRef.current = onPassageCommentTapped
    onTapRef.current = onTap

    // Single-shot onReady. handlePublicationReady is the canonical trigger;
    // handleLocationChange is a defensive fallback for Readium builds where
    // the publication-ready event fires before our JS callback is wired or
    // never reaches us. Either path flips this ref so the host's "Loading
    // book…" overlay can come down. Never reset once true: the wrapper only
    // initializes once per epubUrl, and resetting on host re-renders is what
    // caused the "jumps to chapter 1" bug.
    const readyFiredRef = useRef(false)
    const fireReadyOnce = useCallback(() => {
      if (readyFiredRef.current) return
      readyFiredRef.current = true
      onReadyRef.current?.()
    }, [])
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
    // Live position + TOC, populated by Readium events. The chapter-text
    // and sentence-highlight bridges read these to know which spine item
    // to parse and which sentence text to highlight.
    const currentLocatorRef = useRef<Locator | null>(null)
    const tocRef = useRef<Array<{ label: string; href: string; cfi: string | null }>>([])
    const chapterSentencesRef = useRef<string[]>([])

    const initialLocator = useMemo(() => decodeLocator(initialCfi), [initialCfi])

    const decorations: DecorationGroup[] = useMemo(() => {
      const groups: DecorationGroup[] = [
        { name: HIGHLIGHTS_GROUP, decorations: highlights },
      ]
      if (sentenceDecoration) {
        groups.push({ name: TTS_SENTENCE_GROUP, decorations: [sentenceDecoration] })
      }
      return groups
    }, [highlights, sentenceDecoration])

    const flushLocator = useCallback((locator: Locator) => {
      const serialized = encodeLocator(locator)
      if (serialized === lastSavedLocatorRef.current) return
      lastSavedLocatorRef.current = serialized
      const progression = locator.locations?.progression ?? 0
      onLocationChangeRef.current?.(
        serialized,
        progression,
        undefined,
        locator.text?.highlight,
      )
    }, [])

    // Suppress the very first onLocationChange after mount. Readium emits
    // an initial relocate event when the publication renders -- if we let
    // that fire the host's save, a fresh book with no saved CFI would
    // overwrite Supabase with chapter 1 even if the user never turned a
    // page. After the first event, every subsequent change is a real
    // navigation.
    const firstLocationChangeRef = useRef(true)

    const handleLocationChange = useCallback(
      (locator: Locator) => {
        currentLocatorRef.current = locator
        fireReadyOnce()
        // Chapter changed? Drop any stale sentence decoration so we don't
        // paint a previous chapter's TTS highlight on the new page.
        chapterSentencesRef.current = []
        setSentenceDecoration(null)
        if (locator.title) {
          onChapterChangeRef.current?.({ title: locator.title, index: 0 })
        }
        if (firstLocationChangeRef.current) {
          firstLocationChangeRef.current = false
          return
        }
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => flushLocator(locator), 1500)
      },
      [flushLocator, fireReadyOnce],
    )

    const handlePublicationReady = useCallback(
      (event: PublicationReadyEvent) => {
        tocRef.current = (event.tableOfContents ?? [])
          .filter((link) => !!link.href)
          .map((link) => ({
            label: link.title ?? link.href,
            href: link.href,
            cfi: null,
          }))
        fireReadyOnce()
      },
      [fireReadyOnce],
    )

    // Download the EPUB to local cache on mount so ReadiumView can open it.
    // Cached by URL hash; second open of the same book is essentially free.
    // Deps: epubUrl only. onError is read via ref so a host re-render that
    // changes the inline lambda's identity doesn't re-trigger the effect.
    useEffect(() => {
      let cancelled = false
      ;(async () => {
        try {
          const uri = await ensureEpubLocalUri(epubUrl)
          if (!cancelled) setLocalUri(uri)
        } catch (e) {
          if (cancelled) return
          const message = e instanceof Error ? e.message : 'EPUB download failed'
          console.warn('[readium-reader] local download failed:', message)
          onErrorRef.current?.(message)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [epubUrl])

    // Safety net: if neither onPublicationReady nor onLocationChange has
    // fired 10 seconds after the file is local, surface the canvas anyway.
    // The worst case is the host overlay coming down before Readium actually
    // finishes its first paint, which still beats an indefinite "Loading
    // book…" lock.
    useEffect(() => {
      if (!localUri) return
      const t = setTimeout(() => {
        if (!readyFiredRef.current) {
          console.warn('[readium-reader] ready-event timeout; falling back')
          fireReadyOnce()
        }
      }, 10_000)
      return () => clearTimeout(t)
    }, [fireReadyOnce, localUri])

    const handleSelectionChange = useCallback(
      (event: SelectionEvent) => {
        const text = event.selectedText
        if (!text || !event.locator) return
        const cfi = encodeLocator(event.locator)
        const rect: ReaderRect = {
          x: screenWidth / 2,
          y: screenHeight / 2,
          width: 0,
          height: 0,
        }
        const trimmed = text.trim()
        const isSingleWord =
          trimmed.length > 0 && !/\s/.test(trimmed) && trimmed.length <= 50
        if (isSingleWord && onWordTappedRef.current) {
          const before = event.locator.text?.before ?? ''
          const highlight = event.locator.text?.highlight ?? trimmed
          const after = event.locator.text?.after ?? ''
          const surroundingText = `${before}${highlight}${after}`.trim()
          onWordTappedRef.current(trimmed, surroundingText, cfi, rect)
          return
        }
        onPassageSelectedRef.current?.(text, cfi, rect)
      },
      [screenWidth, screenHeight],
    )

    const handleDecorationActivated = useCallback(
      (event: DecorationActivatedEvent) => {
        if (event.group === HIGHLIGHTS_GROUP) return
        const passageText = event.decoration.locator.text?.highlight ?? ''
        onPassageCommentTappedRef.current?.(
          encodeLocator(event.decoration.locator),
          passageText,
        )
      },
      [],
    )

    useImperativeHandle(
      ref,
      () => ({
        prev: () => viewRef.current?.goBackward(),
        next: () => viewRef.current?.goForward(),
        goTo: (cfi: string, hint?: { text?: string; chapter?: string }) => {
          const locator = decodeLocator(cfi)
          if (locator) {
            viewRef.current?.goTo(locator)
            return
          }
          // Migration path for legacy foliate epubcfi(...) values stored on
          // highlights / bookmarks rows. Build a text-based Locator from
          // the saved excerpt and (when known) the chapter href so Readium
          // can search the publication for a match. Reliability scales
          // with excerpt uniqueness; short or duplicate excerpts may land
          // on the wrong instance.
          const excerpt = hint?.text?.trim()
          if (!excerpt) return
          const chapterEntry = hint?.chapter
            ? tocRef.current.find((t) => t.label === hint.chapter)
            : undefined
          const fallbackHref =
            chapterEntry?.href ?? currentLocatorRef.current?.href
          if (!fallbackHref) return
          viewRef.current?.goTo({
            href: fallbackHref,
            type:
              currentLocatorRef.current?.type ?? 'application/xhtml+xml',
            text: { highlight: excerpt.slice(0, 200) },
          })
        },
        applySettings: (s: ReaderSettings) => {
          // Only theme + fontSize are wired so far. See
          // settingsToReadiumPreferences for the mapping + clamp logic.
          // Other Foliate settings (bold, lineHeight, marginPx, etc.)
          // are silently ignored until each is mapped against a
          // verified Readium range.
          setReadiumPrefs(settingsToReadiumPreferences(s))
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
        setColumns: (_count: number) => {
          // TODO Phase 3.x: re-enable once Preferences are wired (spread +
          // columnCount). Both fields pass straight through enum parsers
          // in NitroTypeConverters so they're safe to send, but the
          // surrounding Preferences object needs the range-checked fields
          // either valid or absent first.
        },
        getChapterText: async () => {
          const href = currentLocatorRef.current?.href
          if (!href) return ''
          const { text } = await getChapterContent(epubUrl, href)
          chapterSentencesRef.current = splitSentences(text)
          return text
        },
        getChapterParagraphs: async () => {
          const href = currentLocatorRef.current?.href
          if (!href) return []
          const { paragraphs } = await getChapterContent(epubUrl, href)
          return paragraphs
        },
        getToc: async () => tocRef.current,
        highlightSentence: (index: number | null) => {
          if (index === null) {
            setSentenceDecoration(null)
            return
          }
          // Index is 1-based per the TtsBar contract; convert to 0-based.
          const sentence = chapterSentencesRef.current[index - 1]
          const currentLoc = currentLocatorRef.current
          if (!sentence || !currentLoc) return
          // Text-based locator: Readium matches `text.highlight` against the
          // rendered page text. before/after windows would improve accuracy
          // for duplicate sentences but the chapter parser doesn't surface
          // them yet; this works well enough for unique-enough prose.
          setSentenceDecoration({
            id: `tts-${index}`,
            locator: {
              href: currentLoc.href,
              type: currentLoc.type,
              text: { highlight: sentence },
            },
            style: {
              type: 'highlight',
              tint: '#FFE082',
            },
          })
        },
        setBilingualContent: (_translations: string[]) => {
          // TODO Phase 3.x: per-paragraph DecorationStyle.html with italic
          // translation block
        },
      }),
      [epubUrl],
    )

    // Tap-to-hide chrome via react-native-gesture-handler. Single-tap with
    // short max duration and tight movement tolerance so RNGH only catches
    // deliberate taps; swipes and long-presses pass through to Readium.
    // Reads onTap via ref so the gesture's identity stays stable across
    // host re-renders (a new gesture identity per render would tear down
    // and rebuild the gesture every page turn).
    const tapGesture = useMemo(
      () =>
        Gesture.Tap()
          .maxDuration(250)
          .maxDistance(10)
          .onEnd((_e, success) => {
            if (success) onTapRef.current?.()
          })
          .runOnJS(true),
      [],
    )

    // Stable references for ReadiumView props so the native side doesn't
    // see a "new file" / "new preferences" on every host re-render and
    // reload the publication (which would jump the reader to its
    // initialLocation, i.e. chapter 1 when no progress is saved yet).
    const file = useMemo(
      () => (localUri ? { url: localUri, initialLocation: initialLocator } : null),
      [localUri, initialLocator],
    )
    const preferencesProp = useMemo(() => readiumPrefs, [readiumPrefs])
    // Pass an empty selectionActions array so the OS text-selection menu
    // has no custom Foxing entries. Whether this also SUPPRESSES the
    // system popup or only EMPTIES our slot of it is a Readium native
    // behavior to verify on device. The floating pill we render on
    // onSelectionChange is the intended primary surface regardless.
    // If the system menu still appears alongside, we accept that and
    // make sure the pill is the prominent one.
    const selectionActions = useMemo<never[]>(() => [], [])

    // No internal loading overlay. The host renders "Loading book…" while
    // readerState === 'loading' (opaque background that covers our canvas);
    // a second overlay here would either be redundant or, if it stayed on
    // forever, would hide Readium's content after the host transitions.
    // Until the EPUB is downloaded we render an empty View; the host
    // overlay covers it.
    if (!file) {
      return (
        <View
          style={{ flex: 1, backgroundColor: initialSettings.theme.background }}
        />
      )
    }

    return (
      <View style={{ flex: 1, backgroundColor: initialSettings.theme.background }}>
        <GestureDetector gesture={tapGesture}>
          <View style={{ flex: 1 }}>
            <ReadiumView
              ref={viewRef}
              file={file}
              preferences={preferencesProp}
              decorations={decorations}
              selectionActions={selectionActions}
              onLocationChange={handleLocationChange}
              onPublicationReady={handlePublicationReady}
              onSelectionChange={handleSelectionChange}
              onDecorationActivated={handleDecorationActivated}
              style={{ flex: 1 }}
            />
          </View>
        </GestureDetector>
      </View>
    )
  },
)

// Bind unused props to silence ESLint when the feature-flagged migration
// path isn't fully exercised yet.
ReadiumReader.displayName = 'ReadiumReader'
