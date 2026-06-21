import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator, AppState, PanResponder, Image, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  CaretLeft,
  CaretUp,
  Sparkle,
  X as XIcon,
} from 'phosphor-react-native'
import { Alert, TextInput as RNTextInput, Modal as RNModal } from 'react-native'
import {
  type BookmarkRow,
  createBookmark,
  findBookmarkAtCfi,
  deleteBookmark,
} from '@/lib/bookmarks'
import { TtsBar } from '@/components/reader/tts-bar'
import { GoToSheet } from '@/components/reader/go-to-sheet'
import { ReaderTopBar } from '@/components/reader/reader-top-bar'
import { supabase } from '@/lib/supabase'
import { reportWriteError } from '@/lib/db-write'
import { Colors, useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import type {
  PassageCommentMarker,
  ReaderRect,
  ReaderRef,
  ReaderSettings,
} from '@/components/reader/foliate-reader-webview'
import { ReadiumReader } from '@/components/reader/readium-reader'
import { PassageCommentSheet } from '@/components/reader/passage-comment-sheet'
import {
  listCommentsForBook,
  listMatchingClubsForBook,
} from '@/lib/passage-comments'
import { listPopularHighlights } from '@/lib/popular-highlights'
import { TypographySheet } from '@/components/reader/typography-sheet'
import { WordLookupSheet } from '@/components/reader/word-lookup-sheet'
import { PassageAnalysisSheet } from '@/components/reader/passage-analysis-sheet'
import { ChapterSummaryModal } from '@/components/reader/chapter-summary-modal'
import { CompanionChat } from '@/components/reader/companion-chat'
import {
  MenuSheet,
  type MenuAction,
  type MenuInitialView,
} from '@/components/reader/menu-sheet'
import { ClubPanelSheet } from '@/components/reader/club-panel-sheet'
import { ProgressSlider } from '@/components/reader/progress-slider'
import type { PassageComment } from '@/lib/passage-comments'
import { SleepTimerSheet, type SleepTimerOption } from '@/components/reader/sleep-timer-sheet'
import { ChapterReactionSheet } from '@/components/reader/chapter-reaction-sheet'
import { privacyToBool, type PrivacyTier } from '@/components/privacy-selector'
import { ChapterFeatureSheet } from '@/components/reader/chapter-feature-sheet'
import type { ChapterFeatureKind } from '@/lib/claude'
import { CharacterMapSheet } from '@/components/reader/character-map-sheet'
import { HighlightsSheet } from '@/components/reader/highlights-sheet'
import { SearchSheet } from '@/components/reader/search-sheet'
import { TranslateSheet } from '@/components/reader/translate-sheet'
import {
  FloatingPill,
  type HighlightColor,
  type PillAnchor,
  type PillMode,
} from '@/components/reader/floating-pill'
import {
  type ReaderPrefs,
  type CanvasTheme,
  DEFAULT_PREFS,
  loadPrefs,
  savePrefs,
  FONT_SIZE_PX,
  LINE_SPACING_VAL,
  LETTER_SPACING_EM,
  MARGIN_PX,
  PARAGRAPH_SPACING_EM,
  FONT_FAMILY_CSS,
} from '@/lib/reader-settings'
import { getWordWiseHints } from '@/lib/claude'
import { resolvePreferredEpubUrl } from '@/lib/books'
import { updateStreak, checkAndAwardBadges } from '@/lib/streaks'
import { haptic } from '@/lib/haptics'
import { enqueue } from '@/lib/offline-queue'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  appendEntry as appendHistoryEntry,
  clearHistory as clearPositionHistory,
  loadHistory as loadPositionHistory,
  saveHistory as savePositionHistory,
  type PositionEntry,
} from '@/lib/position-history'

interface BookRow {
  id: string
  title: string
  author: string
  source: string
  epub_url: string
}

// Reading canvas modes are decoupled from the app's UI theme, they're
// applied to the WebView body (and via setStyles to each chapter iframe).
const CANVAS_PALETTE: Record<CanvasTheme, { background: string; text: string }> = {
  default: { background: Colors.light.bgReading, text: Colors.light.textPrimary },
  sepia: { background: Colors.light.bgReadingSepia, text: Colors.light.textOnSepia },
  dark: { background: Colors.dark.bgReading, text: Colors.dark.textPrimary },
  oled: { background: Colors.dark.bgReadingOled, text: Colors.dark.textOnDark },
}

// "MM:SS" countdown formatter for the sleep-timer badge. Zero-pads seconds
// so the width doesn't jitter as the digit count changes.
function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Convert a 6-digit hex like "#FEFCF8" to an rgba() string at the given
// alpha. Used so the chrome bar can be translucent without the React Native
// `opacity` prop (which would fade the icons inside too).
function hexToRgba(hex: string, alpha: number): string {
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
function prefsToSettings(prefs: ReaderPrefs, isTablet: boolean): ReaderSettings {
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

// Word-pill state carries the surrounding sentence so the WordLookupSheet
// receives real context (the AI prompt is sentence-scoped). Passage-pill
// state carries the full selected text + cfi for the highlight + analyze
// + discuss flows.
interface WordPillState {
  word: string
  surroundingText: string
  cfi: string | null
}

interface PassagePillState {
  text: string
  cfi: string | null
}

// Lightweight transient toast, single instance, auto-dismisses. Kept local
// to the reader because no other screen needs it yet.
function ReaderToast({ message, onHide }: { message: string | null; onHide: () => void }) {
  const colors = useColors()
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onHide, 2500)
    return () => clearTimeout(t)
  }, [message, onHide])
  if (!message) return null
  return (
    <SafeAreaView
      edges={['bottom']}
      pointerEvents="none"
      className="absolute bottom-0 left-0 right-0"
    >
      <View
        className="mx-6 mb-6 px-4 py-3 rounded-xl"
        style={{ backgroundColor: colors.tooltipBg, alignItems: 'center' }}
      >
        <Text
          style={{
            color: colors.tooltipText,
            fontFamily: Fonts.uiMedium,
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          {message}
        </Text>
      </View>
    </SafeAreaView>
  )
}

export default function Reader() {
  const colors = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  // iPad-class width threshold. 768pt is iPad-portrait / common 10" tablet
  // width; below that we treat the device as a phone for layout purposes.
  const { width: windowWidth } = useWindowDimensions()
  const isTablet = windowWidth >= 768
  const readerRef = useRef<ReaderRef>(null)
  const sessionIdRef = useRef<string | null>(null)
  // userId captured into a ref so the unmount cleanup can flush writes
  // without calling supabase.auth.getUser() (a network call that
  // unreliably resolves during teardown / backgrounding).
  const userIdRef = useRef<string | null>(null)
  // UTC date (YYYY-MM-DD) the daily streak update last succeeded on, so
  // pingSession only pays the 4-parallel-counts + upsert + badge fan-out
  // once per day. Mirrored to AsyncStorage so re-opens the same day skip
  // it too; left unset on failure so the next ping retries.
  const streakDateRef = useRef<string | null>(null)
  const positionRef = useRef<{ cfi: string | null; percentage: number }>({
    cfi: null,
    percentage: 0,
  })
  const lastSaveRef = useRef<number>(Date.now())
  const chromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [book, setBook] = useState<BookRow | null>(null)
  // PDFs are detected by URL extension. Foliate handles them natively;
  // we only need to gate features that don't translate cleanly: the word
  // tap pill and Word Wise vocabulary hints both rely on text-flow chunks.
  const isPdf = !!book && /\.pdf(\?|#|$)/i.test(book.epub_url)
  const [loading, setLoading] = useState(true)
  const [initialCfi, setInitialCfi] = useState<string | null>(null)
  const [readerState, setReaderState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [readerError, setReaderError] = useState<string | null>(null)
  const [chrome, setChrome] = useState(false)

  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS)
  const [userId, setUserId] = useState<string | null>(null)
  // Mirror userId into a ref so the unmount cleanup, the 30s ticker,
  // and the chapter-change callback always read the latest without
  // re-binding on every render.
  userIdRef.current = userId
  const [showSettings, setShowSettings] = useState(false)

  const [currentChapter, setCurrentChapter] = useState({ title: '', index: 0 })
  const [progress, setProgress] = useState(0)

  // Floating pill state, anchored to a WebView-local rect. The pill itself
  // handles its own color-picker expansion; we just feed it mode + payload.
  const [pillMode, setPillMode] = useState<PillMode | null>(null)
  const [pillAnchor, setPillAnchor] = useState<PillAnchor | null>(null)
  const [wordPayload, setWordPayload] = useState<WordPillState | null>(null)
  const [passagePayload, setPassagePayload] = useState<PassagePillState | null>(null)

  // Sheet visibility, opened from pill actions or chrome buttons.
  const [wordSheet, setWordSheet] = useState<WordPillState | null>(null)
  const [passageSheet, setPassageSheet] = useState<PassagePillState | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatSeed, setChatSeed] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  // Which view the MenuSheet should open to. The top-bar Sparkle icon
  // routes to the chapter-features sub-grid; the bottom-bar chevron-up
  // routes to the secondary actions list.
  const [menuInitialView, setMenuInitialView] = useState<MenuInitialView>('secondary')
  // Club panel: half-height slide-up. Tapping the bottom-bar club chip
  // opens it; reading continues underneath since the panel isn't a Modal.
  const [clubPanelOpen, setClubPanelOpen] = useState(false)
  const [characterMapOpen, setCharacterMapOpen] = useState(false)
  const [highlightsOpen, setHighlightsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // Translate sheet: holds the selected text split into paragraphs (a word is
  // a single-item list). Rendered side by side with its translation.
  const [translateSel, setTranslateSel] = useState<{ paragraphs: string[] } | null>(null)
  const [chapterFeature, setChapterFeature] = useState<ChapterFeatureKind | null>(null)
  // Chapter check-in, pops a 3-option toast at the bottom after a chapter
  // change. previousChapter holds the just-completed chapter's title; the
  // toast pulls that into its prompt. Auto-dismisses after 10s.
  const [checkinChapter, setCheckinChapter] = useState<string | null>(null)
  const previousChapterRef = useRef<string | null>(null)
  // TTS state, bar visibility, chapter text snapshot, last sentence index.
  const [ttsOpen, setTtsOpen] = useState(false)
  const [ttsText, setTtsText] = useState('')
  // Go To sheet (Contents/Location/Bookmarks/History).
  const [goToOpen, setGoToOpen] = useState(false)
  // Sleep timer, sheet visibility, active option, and remaining ms for the
  // countdown badge. The interval handle lives in a ref so re-renders don't
  // restart the timer; the deadline lives in a ref too so chrome can re-mount
  // mid-countdown without losing the original target time.
  const [sleepSheetOpen, setSleepSheetOpen] = useState(false)
  const [sleepTimer, setSleepTimer] = useState<SleepTimerOption | null>(null)
  const [sleepRemainingMs, setSleepRemainingMs] = useState<number | null>(null)
  const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sleepEndAtRef = useRef<number | null>(null)

  // Position history, last 50 unique CFIs per book, persisted to AsyncStorage.
  // We hold the canonical copy in a ref so onLocation can mutate without
  // re-rendering on every page turn; saves are debounced via a separate ref.
  const positionHistoryRef = useRef<PositionEntry[]>([])
  const historySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // PanResponder closes over this ref so the swipe-back handler always reads
  // the latest state without re-creating the responder on every render.
  const swipeBackRef = useRef<() => void>(() => {})
  // Bookmark for the current position, drives the filled/outline icon.
  const [currentBookmark, setCurrentBookmark] = useState<BookmarkRow | null>(null)
  // Inline bookmark naming modal, shown when the chrome bookmark button
  // is tapped on a position that doesn't have a bookmark yet.
  const [bookmarkPrompt, setBookmarkPrompt] = useState<{ cfi: string; suggestedName: string } | null>(null)

  // Live WPM tracking. Each location change with pageWordCount lets us
  // compute words/sec from the previous sample → smooth into a session
  // average for the bottom-bar reading-rate indicator.
  const lastLocationTimeRef = useRef<number>(Date.now())
  const lastPageWordsRef = useRef<number>(0)
  const wpmSamplesRef = useRef<number[]>([])
  // Page navigations this session, written to reading_sessions.pages_read
  // by the heartbeat. Seeded from the row when resuming an open session.
  const pagesReadRef = useRef<number>(0)
  const [wpm, setWpm] = useState<number | null>(null)
  // Chapter list for the AI semantic search action, populated from
  // foliate's TOC if we can pull it; otherwise just the current chapter.
  const [chapterList, setChapterList] = useState<string[]>([])

  // Transient toast, currently used for "couldn't save highlight" feedback.
  const [toast, setToast] = useState<string | null>(null)

  // Set of bookmarked CFIs for this book, drives the filled vs outline
  // bookmark icon in the top chrome without a per-page-turn DB roundtrip.
  const [bookmarkCfis, setBookmarkCfis] = useState<Set<string>>(new Set())
  const isCurrentBookmarked = useMemo(
    () => !!(positionRef.current.cfi && bookmarkCfis.has(positionRef.current.cfi)),
    // Re-evaluate when progress changes since positionRef is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookmarkCfis, progress],
  )

  // Clubs the viewer belongs to that are currently reading THIS book. Empty
  // = no Club button on the pill, no margin dots. Stored as state so the
  // pill's showClub re-renders when it changes; mirrored to a ref so the
  // WebView callback can read it without re-binding.
  const [matchingClubs, setMatchingClubs] = useState<
    Array<{ club_id: string; name: string }>
  >([])
  const matchingClubsRef = useRef(matchingClubs)
  matchingClubsRef.current = matchingClubs

  // Sheet state, single sheet that handles both "tapped margin dot" and
  // "tapped Club button on the pill". The pill path comes in with the
  // selected passage; the dot path comes in with the commented passage.
  const [commentSheet, setCommentSheet] = useState<{
    cfi: string
    passageText: string
  } | null>(null)

  // Club presence in the bottom chrome, up to 3 avatars of club members
  // with active reading_sessions on this book in the last 30 minutes.
  const [presence, setPresence] = useState<
    Array<{ user_id: string; display_name: string | null; avatar_url: string | null }>
  >([])

  // Word Wise cache + in-flight guard, see onLocation. Keyed by
  // bookId+chapterTitle so we don't refetch the same chapter mid-session.
  // The debounce timer ensures a fast page-flip burst only fires once.
  const wwCacheRef = useRef<Set<string>>(new Set())
  const wwInFlightRef = useRef<Set<string>>(new Set())
  const wwDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const WW_DEBOUNCE_MS = 500

  // The set-interval / cleanup paths fire saveProgress on a stale closure
  // (book is null at first render). Route through a ref so they always
  // call the latest version that closes over the current `book`.
  const saveProgressRef = useRef<() => Promise<void>>(async () => {})

  // Design-token-aware highlight palette pushed into the WebView so the
  // foliate annotation rects match what the FloatingPill swatches preview.
  const highlightPalette = useMemo<Record<HighlightColor, string>>(
    () => ({
      amber: colors.hlAmberT,
      auburn: colors.hlAuburnT,
      yellow: colors.hlYellowT,
      sage: colors.hlSageT,
      cobalt: colors.hlCobaltT,
      crimson: colors.hlCrimsonT,
      purple: colors.hlPurpleT,
    }),
    [colors],
  )

  useEffect(() => {
    if (readerState !== 'ready') return
    readerRef.current?.setHighlightColors(highlightPalette)
  }, [highlightPalette, readerState])

  // Hydrate any prior calibrated WPM so the bottom-bar shows a sensible
  // value before we collect a fresh sample this session.
  useEffect(() => {
    import('@/lib/user-prefs')
      .then((m) => m.getCalibratedWpm())
      .then((w) => {
        if (w) setWpm(w)
      })
      .catch(() => {})
  }, [])

  // Resolve which of the viewer's clubs (if any) are currently reading this
  // book. Both the Club button on the pill and the margin-dot fetch gate
  // on this. Re-runs if either the viewer or the book row changes (a
  // Standard-Ebooks promotion swaps epub_url but keeps book.id, so this
  // doesn't re-run unnecessarily).
  useEffect(() => {
    if (!userId || !book) {
      setMatchingClubs([])
      return
    }
    let mounted = true
    ;(async () => {
      const clubs = await listMatchingClubsForBook(userId, book.id)
      if (mounted) setMatchingClubs(clubs)
    })()
    return () => {
      mounted = false
    }
  }, [userId, book])

  // Club presence: members of matching clubs with active reading_sessions
  // on this book in the last 30 minutes. Re-polls every 60s while the
  // reader is open, enough to feel live without hammering the API.
  useEffect(() => {
    if (!book || matchingClubs.length === 0) {
      setPresence([])
      return
    }
    let mounted = true
    const clubIds = matchingClubs.map((c) => c.club_id)

    async function refresh() {
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const { data: memberRows } = await supabase
        .from('club_members')
        .select('user_id, profile:profiles!user_id(id, display_name, avatar_url)')
        .in('club_id', clubIds)
      type MR = {
        user_id: string
        profile:
          | { id: string; display_name: string | null; avatar_url: string | null }
          | Array<{ id: string; display_name: string | null; avatar_url: string | null }>
          | null
      }
      const profileById = new Map<
        string,
        { id: string; display_name: string | null; avatar_url: string | null }
      >()
      for (const m of ((memberRows ?? []) as unknown) as MR[]) {
        const p = Array.isArray(m.profile) ? m.profile[0] : m.profile
        if (p && m.user_id !== userId) profileById.set(m.user_id, p)
      }
      if (profileById.size === 0) {
        if (mounted) setPresence([])
        return
      }
      const { data: sessions } = await supabase
        .from('reading_sessions')
        .select('user_id')
        .eq('book_id', book!.id)
        .in('user_id', [...profileById.keys()])
        .gte('started_at', since)
        .is('ended_at', null)
      const activeIds = new Set(
        ((sessions ?? []) as Array<{ user_id: string }>).map((s) => s.user_id),
      )
      const out = [...profileById.values()]
        .filter((p) => activeIds.has(p.id))
        .slice(0, 3)
        .map((p) => ({
          user_id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
        }))
      if (mounted) setPresence(out)
    }

    refresh()
    const interval = setInterval(refresh, 60_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [book, matchingClubs, userId])

  // Popular highlights, gated on the prefs toggle. Push to the reader
  // when toggled on (or when the book/user changes); push empty when off.
  useEffect(() => {
    if (readerState !== 'ready' || !book) return
    if (!prefs.popularHighlightsEnabled) {
      readerRef.current?.setPopularHighlights([])
      return
    }
    let mounted = true
    ;(async () => {
      const list = await listPopularHighlights({
        bookId: book.id,
        viewerId: userId,
        minCount: 3,
      })
      if (!mounted) return
      readerRef.current?.setPopularHighlights(list, colors.textTertiary)
    })()
    return () => {
      mounted = false
    }
  }, [readerState, book, userId, prefs.popularHighlightsEnabled, colors.textTertiary])

  // Push comments into the reader for margin-dot rendering. Re-runs when
  // matchingClubs OR the reader transitions to ready.
  useEffect(() => {
    if (readerState !== 'ready' || !book) return
    if (matchingClubs.length === 0) {
      readerRef.current?.setPassageComments([])
      return
    }
    let mounted = true
    ;(async () => {
      const rows = await listCommentsForBook(
        book.id,
        matchingClubs.map((c) => c.club_id),
      )
      if (!mounted) return
      const markers: PassageCommentMarker[] = rows.map((r) => ({
        cfi: r.cfi,
        passageText: r.passage_text ?? '',
      }))
      readerRef.current?.setPassageComments(markers, colors.brandUi)
    })()
    return () => {
      mounted = false
    }
  }, [readerState, book, matchingClubs, colors.brandUi])

  // Swipe responder claims ONE gesture while otherwise letting taps fall
  // through to the WebView:
  //   • left-edge swipe right → pop the last entry off position history and
  //     navigate to the new tail (history-back)
  // Chrome is toggled by a center tap (the WebView's onTap), so the old
  // top-edge reveal swipe is gone. We never claim onStart so tap-to-flip
  // pages still works; the move check gates on a clear left-edge gesture.
  const swipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const startX = evt.nativeEvent.pageX - gestureState.dx
        const leftSwipeRight =
          startX < 32 &&
          gestureState.dx > 36 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
        return leftSwipeRight
      },
      onPanResponderGrant: (evt, gestureState) => {
        const startX = evt.nativeEvent.pageX - gestureState.dx
        if (startX < 32 && gestureState.dx > 36) {
          swipeBackRef.current()
        }
      },
    }),
  ).current

  useEffect(() => {
    if (!id) return
    let mounted = true
    ;(async () => {
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('id, title, author, source, epub_url')
        .eq('id', id)
        .single()
      console.log('[reader] book query result', { bookData, error: bookError?.message })
      if (!mounted || !bookData) {
        setLoading(false)
        return
      }

      // Prefer the Standard Ebooks edition when one exists. We swap only
      // the epub_url, book.id stays the row the user tapped, so their
      // progress, highlights, and vocabulary remain associated with it.
      // Resolve BEFORE setBook so the WebView mounts straight to the SE
      // bytes; otherwise the Gutenberg URL would briefly download first.
      const typedBook = bookData as BookRow
      const preferredUrl = await resolvePreferredEpubUrl(typedBook)
      if (!mounted) return
      setBook({ ...typedBook, epub_url: preferredUrl })

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: ub } = await supabase
          .from('user_books')
          .select('status, progress_cfi, progress_percentage, started_at')
          .eq('user_id', user.id)
          .eq('book_id', bookData.id)
          .maybeSingle()
        if (ub?.progress_cfi) setInitialCfi(ub.progress_cfi)
        if (ub?.progress_percentage) setProgress(ub.progress_percentage)

        // Land a row on the Reading shelf the moment the book is opened.
        // Without this the shelf stayed empty until the user actually turned
        // a page (saveProgress is gated on progress_cfi being non-null and
        // the wrapper now suppresses the first locator emit). Only promote
        // statuses that should advance: a missing row, a 'want_to_read'
        // intent, or an 'abandoned' return both make sense; 'finished' and
        // 'paused' stay where they are so opening a finished book to
        // reference a passage doesn't bounce it back to Reading.
        const shouldPromote =
          !ub || ub.status === 'want_to_read' || ub.status === 'abandoned'
        if (shouldPromote) {
          const update: Record<string, unknown> = {
            user_id: user.id,
            book_id: bookData.id,
            status: 'reading',
          }
          if (!ub?.started_at) update.started_at = new Date().toISOString()
          const { error: shelfErr } = await supabase
            .from('user_books')
            .upsert(update, { onConflict: 'user_id,book_id' })
          if (shelfErr) {
            console.warn(
              '[reader] shelf upsert failed:',
              shelfErr.message,
            )
          }
        }

        // Resume a dangling open session for this user+book instead of
        // stacking a new row per mount (remounts from app restarts, OTA
        // reloads, and quick close/reopen were creating duplicates).
        // ended_at null + started_at within 30 minutes is the same
        // definition of "active" the club-presence query uses. A cleanly
        // heartbeated session has ended_at set, so a fresh open after one
        // correctly starts a new row.
        const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
        const { data: open, error: openErr } = await supabase
          .from('reading_sessions')
          .select('id, pages_read')
          .eq('user_id', user.id)
          .eq('book_id', bookData.id)
          .is('ended_at', null)
          .gte('started_at', since)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (openErr) {
          console.warn('[reader] open-session lookup failed:', openErr.message)
        }
        const openSess = open as { id: string; pages_read: number | null } | null
        if (openSess) {
          sessionIdRef.current = openSess.id
          pagesReadRef.current = openSess.pages_read ?? 0
        } else {
          const { data: sess, error: sessErr } = await supabase
            .from('reading_sessions')
            .insert({
              user_id: user.id,
              book_id: bookData.id,
              started_at: new Date().toISOString(),
            })
            .select('id')
            .single()
          if (sessErr) {
            console.warn('[reader] session insert failed:', sessErr.message)
          }
          if (sess) sessionIdRef.current = sess.id
        }
      }
      // Load reader prefs (per user; falls back to anon key if signed out).
      const loaded = await loadPrefs(user?.id ?? null)
      if (mounted) setPrefs(loaded)
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [id])

  // The interval + cleanup both call through saveProgressRef so they always
  // see the latest closure (book/userId). Without this they'd capture the
  // first render's saveProgress, which returns early because book is null.
  // pingSession bumps reading_sessions.ended_at every tick so the unmount
  // path is a final flush, not the only write path. Previously the unmount
  // ended_at update raced the JS-bridge teardown and ~45% of sessions on
  // production had null ended_at.
  useEffect(() => {
    const t = setInterval(() => {
      saveProgressRef.current().catch((e) =>
        console.warn('[reader] interval save failed:', e instanceof Error ? e.message : e),
      )
      pingSession().catch((e) =>
        console.warn('[reader] interval ping failed:', e instanceof Error ? e.message : e),
      )
    }, 30000)
    return () => {
      clearInterval(t)
      if (wwDebounceRef.current) clearTimeout(wwDebounceRef.current)
      saveProgressRef.current().catch((e) =>
        console.warn('[reader] unmount save failed:', e instanceof Error ? e.message : e),
      )
      pingSession().catch((e) =>
        console.warn('[reader] unmount ping failed:', e instanceof Error ? e.message : e),
      )
    }
  }, [])

  // Flush progress + heartbeat when the app leaves the foreground. JS
  // timers pause in the background and the unmount cleanup never runs on
  // app-switch, screen lock, app kill, or an OTA reload, so without this
  // a session that ends by backgrounding keeps a stale ended_at forever.
  // Best-effort: the transition usually lets in-flight requests finish.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') return
      saveProgressRef.current().catch((e) =>
        console.warn('[reader] background save failed:', e instanceof Error ? e.message : e),
      )
      pingSession().catch((e) =>
        console.warn('[reader] background ping failed:', e instanceof Error ? e.message : e),
      )
    })
    return () => sub.remove()
  }, [])

  // Auto-hide chrome 3s after it appears (same duration as the on-open peek
  // below for consistency, users learn one rhythm).
  useEffect(() => {
    if (chromeTimerRef.current) {
      clearTimeout(chromeTimerRef.current)
      chromeTimerRef.current = null
    }
    if (chrome) {
      chromeTimerRef.current = setTimeout(() => setChrome(false), 3000)
    }
    return () => {
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current)
    }
  }, [chrome])

  // On book open, peek chrome for 3s so the user sees Back / Aa / menu
  // affordances exist. The auto-hide effect above handles the timeout.
  useEffect(() => {
    if (readerState === 'ready') setChrome(true)
  }, [readerState])

  // Keep screen awake while reading, gated on the Settings → Reading
  // toggle. expo-keep-awake activates the platform's no-sleep flag on
  // mount; we deactivate on unmount. Safe to call multiple times; the
  // module reference-counts.
  useEffect(() => {
    let active = false
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem('reading_defaults')
        const prefs = raw ? (JSON.parse(raw) as { keepAwake?: boolean }) : null
        if (prefs?.keepAwake !== true) return
        await activateKeepAwakeAsync('foxing-reader')
        active = true
      } catch {
        /* keep-awake unavailable, silently skip */
      }
    })()
    return () => {
      if (active) {
        try { deactivateKeepAwake('foxing-reader') } catch {}
      }
    }
  }, [])

  // Word Wise toggle → bridge. When disabled, the bridge clears any
  // already-injected hints; when enabled, the next onLocation triggers
  // the first fetch. We don't backfill the current page on toggle-on.
  // a single page turn brings hints in.
  useEffect(() => {
    if (readerState !== 'ready') return
    readerRef.current?.setWordWiseEnabled(prefs.wordWiseEnabled)
  }, [prefs.wordWiseEnabled, readerState])

  // Auto-scroll → bridge. Starts/stops a per-page interval that calls
  // renderer.next() at the rate the user set in the Aa sheet.
  useEffect(() => {
    if (readerState !== 'ready') return
    if (prefs.autoScroll) readerRef.current?.startAutoScroll(prefs.autoScrollWpm)
    else readerRef.current?.stopAutoScroll()
  }, [prefs.autoScroll, prefs.autoScrollWpm, readerState])

  // Columns → bridge. Foliate's paginator reads max-column-count; we toggle
  // between 1 and 2 based on prefs (with a tablet upgrade applied below).
  useEffect(() => {
    if (readerState !== 'ready') return
    readerRef.current?.setColumns(prefs.columnMode === 'two' ? 2 : 1)
  }, [prefs.columnMode, readerState])

  // One-time tablet column upgrade. New tablet users get a 2-column spread
  // on first reader open; subsequent opens read the persisted pref. Tracked
  // via an AsyncStorage flag keyed by user so the upgrade isn't re-applied
  // if the user later toggles back to single in the Aa sheet.
  useEffect(() => {
    if (!isTablet || !userId || readerState !== 'ready') return
    let cancelled = false
    AsyncStorage.getItem(`foxing.tablet-columns-applied.${userId}`).then((applied) => {
      if (cancelled || applied === 'true') return
      if (prefs.columnMode === 'single') {
        changePrefs({ ...prefs, columnMode: 'two' })
      }
      AsyncStorage.setItem(`foxing.tablet-columns-applied.${userId}`, 'true').catch(() => {})
    })
    return () => {
      cancelled = true
    }
    // changePrefs intentionally excluded, it's stable enough for this
    // one-shot and re-adding it would re-fire when prefs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTablet, userId, readerState])

  // Bilingual mode, fetch translations for the current chapter's
  // paragraphs and push them back into the reader. Re-runs on chapter
  // change (currentChapter.title), language change, or toggle. Clears
  // translations when bilingualMode flips off.
  useEffect(() => {
    if (readerState !== 'ready' || !book) return
    // Bilingual translation is disabled (D13): the paid bilingual_paragraph
    // AI call did not render usefully in-reader, so we skip the API spend and
    // just ensure no stale translations remain shown.
    readerRef.current?.setBilingualContent([])
  }, [readerState, book])

  const toggleChrome = useCallback(() => setChrome((v) => !v), [])

  async function saveProgress() {
    if (!book || !positionRef.current.cfi) return
    if (Date.now() - lastSaveRef.current < 5000) return
    lastSaveRef.current = Date.now()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('user_books')
      .upsert(
        {
          user_id: user.id,
          book_id: book.id,
          status: 'reading',
          progress_cfi: positionRef.current.cfi,
          progress_percentage: positionRef.current.percentage,
        },
        { onConflict: 'user_id,book_id' },
      )
    reportWriteError(error, { op: 'upsert', table: 'user_books', extra: { bookId: book.id } })
  }

  // Keep the ref pointed at the current-render saveProgress so the interval
  // started in the mount effect always invokes the freshest closure.
  saveProgressRef.current = saveProgress

  // Rolling heartbeat. Called every 30s by the interval, on app
  // background, and one final time on unmount; previously this was an
  // end-of-life write that raced the JS-bridge teardown and dropped ~45%
  // of session close-outs. Reads refs only (always current), so the
  // closure captured by the mount-effect's interval/cleanup is safe.
  // Throws on failure: supabase-js returns { error } instead of throwing,
  // and an RLS-filtered update "succeeds" with 0 rows, so both cases are
  // checked explicitly and surfaced to the callers' catch handlers.
  async function pingSession() {
    if (!sessionIdRef.current) return
    const samples = wpmSamplesRef.current
    const patch: Record<string, unknown> = {
      ended_at: new Date().toISOString(),
      pages_read: pagesReadRef.current,
    }
    if (samples.length > 0) {
      patch.avg_wpm = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
      patch.last_wpm = Math.round(samples[samples.length - 1])
    }
    const { data, error } = await supabase
      .from('reading_sessions')
      .update(patch)
      .eq('id', sessionIdRef.current)
      .select('id')
    if (error) {
      throw new Error(`session heartbeat failed: ${error.message}`)
    }
    if (!data || data.length === 0) {
      throw new Error('session heartbeat updated 0 rows (RLS rejection or stale session id)')
    }
    // A successful heartbeat is the ground truth that reading happened
    // today; the old chapter-change trigger never fired for publications
    // whose locators lack titles. Failures are logged but don't fail the
    // heartbeat itself, and the gate stays unset so the next ping retries.
    await maybeFireDailyStreak().catch((e) => {
      console.warn(
        '[reader] daily streak update failed:',
        e instanceof Error ? e.message : e,
      )
    })
  }

  // First-successful-ping-of-the-day streak trigger. Uses the same UTC
  // date math as updateStreak. The AsyncStorage gate spans reader
  // remounts; the ref spares the storage read on every subsequent ping.
  async function maybeFireDailyStreak() {
    const uid = userIdRef.current
    if (!uid) return
    const today = new Date().toISOString().slice(0, 10)
    if (streakDateRef.current === today) return
    const gateKey = `foxing.streak-fired.${uid}`
    const stored = await AsyncStorage.getItem(gateKey).catch(() => null)
    if (stored === today) {
      streakDateRef.current = today
      return
    }
    await updateStreak(uid)
    streakDateRef.current = today
    AsyncStorage.setItem(gateKey, today).catch(() => {})
  }

  function onLocation(cfi: string, percentage: number, pageWordCount?: number, pageText?: string) {
    positionRef.current = { cfi, percentage }
    setProgress(percentage)
    // The wrapper suppresses the initial relocate and debounces bursts, so
    // every call here is a real navigation the heartbeat can count.
    pagesReadRef.current += 1

    // Position history, append (collapsing consecutive same-CFI). Debounced
    // save so a burst of page turns doesn't hammer AsyncStorage.
    if (book && cfi) {
      positionHistoryRef.current = appendHistoryEntry(positionHistoryRef.current, {
        cfi,
        chapter: currentChapter.title || null,
        timestamp: Date.now(),
        progress: percentage,
      })
      if (historySaveTimerRef.current) clearTimeout(historySaveTimerRef.current)
      const bookId = book.id
      historySaveTimerRef.current = setTimeout(() => {
        savePositionHistory(bookId, positionHistoryRef.current).catch(() => {})
      }, 2000)
    }

    // Update rolling WPM average. We use the previous page's word count
    // and the time delta, the new pageWordCount becomes "previous" on
    // the next call. First call seeds; can't compute WPM until call #2.
    const now = Date.now()
    const prevWords = lastPageWordsRef.current
    const elapsedSec = (now - lastLocationTimeRef.current) / 1000
    if (prevWords > 0 && elapsedSec > 5 && elapsedSec < 600) {
      const sample = (prevWords / elapsedSec) * 60
      if (sample > 30 && sample < 1500) {
        wpmSamplesRef.current = [...wpmSamplesRef.current.slice(-4), sample]
        const avg = wpmSamplesRef.current.reduce((a, b) => a + b, 0) / wpmSamplesRef.current.length
        const rounded = Math.round(avg)
        setWpm(rounded)
        // Persist calibrated WPM so /settings can show it + Recalibrate.
        // Best-effort; never block reading on the AsyncStorage write.
        import('@/lib/user-prefs')
          .then((m) => m.setCalibratedWpm(rounded))
          .catch(() => {})
      }
    }
    lastLocationTimeRef.current = now
    if (pageWordCount && pageWordCount > 0) lastPageWordsRef.current = pageWordCount

    // AI Word Wise, debounced, deduped, in-flight-guarded fetch. Cache key
    // is bookId+chapterTitle: rapid page-flips within a chapter only hit the
    // API once. Debounce absorbs the burst that fires when foliate emits
    // multiple relocate events in quick succession on a chapter boundary.
    if (prefs.wordWiseEnabled && !isPdf && pageText && pageText.length > 50 && book) {
      const cacheKey = `${book.id}::${currentChapter.title || '__nochapter__'}`
      if (wwCacheRef.current.has(cacheKey)) {
        // Already fetched this chapter this session, nothing to do.
      } else if (!wwInFlightRef.current.has(cacheKey)) {
        if (wwDebounceRef.current) clearTimeout(wwDebounceRef.current)
        wwDebounceRef.current = setTimeout(() => {
          // Re-check the guards inside the timer: the user may have toggled
          // Word Wise off, navigated away, or another timer may have fired.
          if (!prefs.wordWiseEnabled) return
          if (wwCacheRef.current.has(cacheKey)) return
          if (wwInFlightRef.current.has(cacheKey)) return
          wwInFlightRef.current.add(cacheKey)
          ;(async () => {
            try {
              const hints = await getWordWiseHints(
                pageText,
                book.title,
                book.author,
                currentChapter.title,
                { bookId: book.id, progress: percentage },
              )
              wwCacheRef.current.add(cacheKey)
              if (hints.length > 0) readerRef.current?.applyWordWiseHints(hints)
            } catch (e) {
              console.warn('[reader] word wise fetch failed:', e instanceof Error ? e.message : e)
            } finally {
              wwInFlightRef.current.delete(cacheKey)
            }
          })()
        }, WW_DEBOUNCE_MS)
      }
    }
  }

  function changePrefs(next: ReaderPrefs) {
    setPrefs(next)
    // Persist async; we don't block UI on the AsyncStorage write.
    savePrefs(userId, next).catch((e) => console.warn('[reader] save prefs failed:', e))
    // Push the resolved settings into the WebView so the change is visible
    // immediately, same code path as initial mount.
    readerRef.current?.applySettings(prefsToSettings(next, isTablet))
  }

  function dismissPill() {
    setPillMode(null)
    setPillAnchor(null)
    setWordPayload(null)
    setPassagePayload(null)
  }

  // ── Sleep timer ─────────────────────────────────────────────────────────
  // Cleared on unmount. Minute-based timers tick via setInterval; the
  // end-of-chapter mode just sits dormant until onChapterChange fires.
  function clearSleepInterval() {
    if (sleepIntervalRef.current) {
      clearInterval(sleepIntervalRef.current)
      sleepIntervalRef.current = null
    }
    sleepEndAtRef.current = null
  }

  const expireSleepTimer = useCallback(async () => {
    clearSleepInterval()
    setSleepTimer(null)
    setSleepRemainingMs(null)
    try { await saveProgressRef.current() } catch {}
    setToast('Your place is saved.')
    // Brief delay so the toast registers before the reader unmounts and
    // the library tab paints over it.
    setTimeout(() => {
      router.replace('/(tabs)/library' as never)
    }, 1200)
  }, [router])

  const onPickSleepOption = useCallback((opt: SleepTimerOption) => {
    setSleepSheetOpen(false)
    clearSleepInterval()
    if (opt.kind === 'cancel') {
      setSleepTimer(null)
      setSleepRemainingMs(null)
      return
    }
    if (opt.kind === 'end_of_chapter') {
      setSleepTimer(opt)
      setSleepRemainingMs(null)
      return
    }
    const totalMs = opt.minutes * 60_000
    const endAt = Date.now() + totalMs
    sleepEndAtRef.current = endAt
    setSleepTimer(opt)
    setSleepRemainingMs(totalMs)
    sleepIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, endAt - Date.now())
      setSleepRemainingMs(remaining)
      if (remaining <= 0) {
        expireSleepTimer()
      }
    }, 1000)
  }, [expireSleepTimer])

  // Clear the interval on unmount so the setInterval doesn't outlive the
  // reader and try to update state on a stale tree.
  useEffect(() => () => clearSleepInterval(), [])

  // ── Pill action handlers ────────────────────────────────────────────────

  async function handleHighlight(color: HighlightColor, privacy: PrivacyTier = 'public') {
    // Resolve the active payload (word or passage) to a single highlight row.
    const cfi = (pillMode === 'word' ? wordPayload?.cfi : passagePayload?.cfi) ?? null
    const text = pillMode === 'word' ? wordPayload?.word : passagePayload?.text
    if (!cfi || !text || !book) {
      console.warn(
        '[reader] highlight skipped, missing cfi/text/book',
        { hasCfi: !!cfi, hasText: !!text, hasBook: !!book, mode: pillMode },
      )
      // Tell the user something happened, silent dismiss was the prior bug.
      if (!cfi && text && book) {
        setToast("Couldn't save highlight, try selecting again.")
      }
      dismissPill()
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      dismissPill()
      return
    }
    const isPublic = privacyToBool(privacy)
    const { error } = await supabase.from('highlights').insert({
      user_id: user.id,
      book_id: book.id,
      cfi,
      text,
      color,
      chapter: currentChapter.title || null,
      is_public: isPublic,
    })
    if (error) {
      console.warn('[reader] save highlight failed:', error.message)
      // Network/server hiccup, queue the write to retry once we're back
      // online. The optimistic visual highlight already painted; if the
      // queued write succeeds the row lands and survives across launches.
      enqueue({
        table: 'highlights',
        op: 'insert',
        data: {
          user_id: user.id,
          book_id: book.id,
          cfi,
          text,
          color,
          chapter: currentChapter.title || null,
          is_public: isPublic,
        },
      }).catch(() => {})
      readerRef.current?.addHighlight(cfi, color)
      haptic.light()
    } else {
      readerRef.current?.addHighlight(cfi, color)
      haptic.light()
      // First/100th highlight badges, fire-and-forget so the pill dismiss
      // doesn't wait on a network round-trip.
      checkAndAwardBadges(user.id).catch(() => {})
      // Shared-highlight notification, if any followed user has a highlight
      // at the SAME CFI on this book, ping them. We use exact CFI match
      // because "within 100 chars" doesn't translate cleanly to CFI string
      // distance, different chapters can produce wildly different strings.
      ;(async () => {
        const { data: followsRows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
        const followedIds = ((followsRows ?? []) as Array<{ following_id: string }>).map((r) => r.following_id)
        if (followedIds.length === 0) return
        const { data: matches } = await supabase
          .from('highlights')
          .select('user_id')
          .eq('book_id', book.id)
          .eq('cfi', cfi)
          .in('user_id', followedIds)
        if (!matches || matches.length === 0) return
        const { data: me } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', user.id)
          .maybeSingle()
        const me2 = me as { display_name: string | null; username: string | null } | null
        const myName = me2?.display_name ?? me2?.username ?? 'Someone'
        const { createNotification } = await import('@/lib/notifications')
        const seen = new Set<string>()
        for (const row of matches as Array<{ user_id: string }>) {
          if (seen.has(row.user_id)) continue
          seen.add(row.user_id)
          await createNotification(
            row.user_id,
            'shared_highlight',
            `${myName} highlighted the same passage`,
            `In ${book.title}, tap to see their note.`,
            { book_id: book.id, cfi, by_user_id: user.id },
          )
        }
      })().catch(() => {})
    }
    // Word highlight also auto-saves vocabulary so the word ends up in
    // the Vocabulary screen even if the user didn't tap "Look up".
    if (pillMode === 'word' && wordPayload) {
      const { error: vocabErr } = await supabase.from('vocabulary').insert({
        user_id: user.id,
        book_id: book.id,
        book_title: book.title,
        word: wordPayload.word,
        // `context` is NOT NULL in the legacy schema, keep it populated
        // alongside the new `context_sentence` column.
        context: wordPayload.surroundingText,
        context_sentence: wordPayload.surroundingText,
        // definition is also NOT NULL legacy, fill with a placeholder for
        // highlight-only saves; lookups overwrite this with the real AI text.
        definition: '(highlighted, open to look up definition)',
      })
      reportWriteError(vocabErr, { op: 'insert', table: 'vocabulary' })
    }
    dismissPill()
  }

  function handleLookup() {
    if (!wordPayload) {
      dismissPill()
      return
    }
    setWordSheet(wordPayload)
    dismissPill()
  }

  function handleAnalyze() {
    if (!passagePayload) {
      dismissPill()
      return
    }
    setPassageSheet(passagePayload)
    dismissPill()
  }

  // Ask seeds the companion chat with the current selection. Works for both a
  // tapped word (with its sentence context) and a selected passage. Renamed
  // from the old passage-only "Discuss".
  function handleAsk() {
    if (pillMode === 'word' && wordPayload) {
      setChatSeed(
        `I'm reading and selected the word "${wordPayload.word}" in this sentence: "${wordPayload.surroundingText}". What would you like to know about it?`,
      )
      setChatOpen(true)
      dismissPill()
      return
    }
    if (passagePayload) {
      setChatSeed(
        `I selected this passage: "${passagePayload.text}", what would you like to discuss about it?`,
      )
      setChatOpen(true)
      dismissPill()
      return
    }
    dismissPill()
  }

  // Translate opens the side-by-side sheet for the current selection, using the
  // reader's saved target language (prefs.targetLanguage). A word becomes a
  // single-paragraph translation; a passage is split on blank lines.
  function handleTranslate() {
    const raw = pillMode === 'word' ? wordPayload?.word : passagePayload?.text
    if (!raw) {
      dismissPill()
      return
    }
    const paragraphs =
      pillMode === 'word'
        ? [raw]
        : raw
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
    setTranslateSel({ paragraphs: paragraphs.length ? paragraphs : [raw] })
    dismissPill()
  }

  function handleMenuAction(action: MenuAction) {
    setMenuOpen(false)
    switch (action) {
      case 'ask-chat':
        // Standalone ask-questions entry: open the companion in general mode
        // with no passage seed (book + current chapter context only).
        setChatSeed(null)
        setChatOpen(true)
        break
      case 'story-so-far':
        setSummaryOpen(true)
        break
      case 'character-map':
        setCharacterMapOpen(true)
        break
      case 'highlights':
        setHighlightsOpen(true)
        break
      case 'vocabulary':
        // Full-screen route. Pre-filter to this book. Cast: Expo Router's
        // generated route types only refresh when Metro runs, on a cold
        // tsc the new file isn't known yet.
        if (book) router.push(`/vocabulary?bookId=${book.id}` as never)
        break
      case 'search':
        setSearchOpen(true)
        break
      case 'quote-card':
        if (book) {
          router.push(
            `/quote-card?bookId=${book.id}&bookTitle=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}` as never,
          )
        }
        break
      case 'my-clubs':
        // First matching club for now. A multi-club picker is a future PR
        // (Part 12 spec only requires routing to a ClubDetailScreen).
        if (matchingClubs.length > 0) {
          router.push(`/clubs/${matchingClubs[0].club_id}` as never)
        }
        break
      case 'chapter-features':
        // Handled internally by MenuSheet (opens sub-list, then onChapterFeature).
        break
      case 'listen':
        // Pull the current chapter's plain text from the WebView, then
        // surface the TTS bar. The bar handles split-into-sentences locally.
        ;(async () => {
          try {
            const text = await (readerRef.current?.getChapterText?.() ?? Promise.resolve(''))
            setTtsText(text ?? '')
            setTtsOpen(true)
          } catch (e) {
            console.warn('[reader] getChapterText failed:', e instanceof Error ? e.message : e)
            setToast("Couldn't load this chapter's text for Listen.")
          }
        })()
        break
      case 'go-to':
        setGoToOpen(true)
        break
      case 'sleep-timer':
        setSleepSheetOpen(true)
        break
    }
  }

  // Load this book's bookmark CFIs once on open so the chrome icon can
  // reflect filled/outline state without a network call per page turn.
  useEffect(() => {
    if (!book) return
    let mounted = true
    ;(async () => {
      const { listBookmarks } = await import('@/lib/bookmarks')
      const rows = await listBookmarks(book.id)
      if (!mounted) return
      setBookmarkCfis(new Set(rows.map((r) => r.cfi)))
    })()
    return () => {
      mounted = false
    }
  }, [book])

  // Hydrate per-book position history on open. The ref is the source of truth
  // mid-session, onLocation appends to it directly and a debounced save
  // mirrors changes to AsyncStorage. GoToSheet's History tab pulls a snapshot
  // via the loadHistory prop each time it opens.
  useEffect(() => {
    if (!book) return
    let mounted = true
    loadPositionHistory(book.id).then((rows) => {
      if (mounted) positionHistoryRef.current = rows
    })
    return () => {
      mounted = false
    }
  }, [book])

  // Persist any pending history write on unmount so a quick close doesn't
  // lose the most recent entry.
  useEffect(() => () => {
    if (historySaveTimerRef.current) clearTimeout(historySaveTimerRef.current)
    const b = book
    if (b) savePositionHistory(b.id, positionHistoryRef.current).catch(() => {})
  }, [book])

  // Pop the current position off history and navigate to the new tail. We
  // don't suppress the navigation's own onLocation callback because the
  // append helper collapses consecutive same-CFI entries, so the destination
  // simply refreshes in place instead of growing the list.
  const onSwipeBack = useCallback(() => {
    const history = positionHistoryRef.current
    if (history.length < 2 || !book) return
    const next = history.slice(0, -1)
    positionHistoryRef.current = next
    savePositionHistory(book.id, next).catch(() => {})
    const target = next[next.length - 1]
    readerRef.current?.goTo(target.cfi)
    haptic.light()
  }, [book])
  swipeBackRef.current = onSwipeBack

  // Bookmark button handler, toggle if current position is bookmarked,
  // else open the naming prompt.
  const onBookmarkTap = useCallback(async () => {
    const cfi = positionRef.current.cfi
    if (!cfi || !book) {
      setToast("Couldn't read the current position. Try turning the page.")
      return
    }
    if (bookmarkCfis.has(cfi)) {
      const existing = await findBookmarkAtCfi(book.id, cfi)
      if (existing) {
        await deleteBookmark(existing.id)
        setBookmarkCfis((s) => {
          const next = new Set(s)
          next.delete(cfi)
          return next
        })
        setToast('Bookmark removed.')
      }
      return
    }
    haptic.light()
    const suggested = `${currentChapter.title || 'Bookmark'} · ${Math.round(progress * 100)}%`
    setBookmarkPrompt({ cfi, suggestedName: suggested })
  }, [book, bookmarkCfis, currentChapter.title, progress])

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }

  if (!book) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8 bg-bg-base-light dark:bg-bg-base-dark">
        <Text className="font-ui mb-4 text-text-primary-light dark:text-text-primary-dark">
          We couldn't load that book.
        </Text>
        <Pressable onPress={() => router.back()} className="flex-row items-center">
          <CaretLeft color={colors.brandText} size={18} />
          <Text className="font-ui text-brand-text-light dark:text-brand-text-dark ml-1">Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const themeColors = CANVAS_PALETTE[prefs.canvasTheme]
  const initialSettings: ReaderSettings = prefsToSettings(prefs, isTablet)

  // Wood-engraving chrome: cream surface (bgBase maps to the Cream token in
  // light, warm near-black in dark), translucent so the reading canvas reads
  // through. Mapped to existing tokens so dark mode keeps adapting.
  const chromeBg = hexToRgba(colors.bgBase, 0.95)

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: themeColors.background }}
      {...swipeResponder.panHandlers}
    >
      <ReadiumReader
        ref={readerRef}
        epubUrl={book.epub_url}
        initialCfi={initialCfi ?? undefined}
        initialSettings={initialSettings}
        onReady={() => {
          setReaderState('ready')
          setReaderError(null)
        }}
        onError={(message) => {
          console.log('[reader] error', message)
          setReaderState('error')
          setReaderError(message)
        }}
        onLocationChange={onLocation}
        onChapterChange={(c) => {
          // Detect a fresh chapter transition. The first onChapterChange
          // after open populates previousChapter with the chapter we
          // landed on; subsequent transitions fire the comprehension
          // check-in for the chapter we just left.
          const prevTitle = previousChapterRef.current
          const isRealTransition = !!prevTitle && prevTitle !== c.title
          if (isRealTransition) {
            setCheckinChapter(prevTitle!)
            // End-of-chapter sleep mode fires once on the next real
            // transition. Wait until after the state update so the user
            // sees the new chapter momentarily before we save + navigate.
            if (sleepTimer?.kind === 'end_of_chapter') {
              expireSleepTimer()
            }
          }
          previousChapterRef.current = c.title
          setCurrentChapter({ title: c.title, index: 0 })
          // Append to TOC sample for AI semantic-search if this chapter is new.
          setChapterList((prev) => (prev.includes(c.title) ? prev : [...prev, c.title]))
        }}
        onWordTapped={(word, surroundingText, cfi, rect: ReaderRect) => {
          // PDF mode: foliate's word boundaries are unreliable, so suppress
          // the tap pill entirely and just toggle chrome.
          if (isPdf) {
            toggleChrome()
            return
          }
          console.log('[reader] word tap', { word, rect })
          // Tapping a different word while a pill is active dismisses the
          // old one and shows the new one, feels right; users wouldn't
          // expect the old pill to stick.
          setWordPayload({ word, surroundingText, cfi })
          setPassagePayload(null)
          setPillAnchor(rect)
          setPillMode('word')
          haptic.light()
        }}
        onPassageSelected={(text, cfi, rect: ReaderRect) => {
          console.log('[reader] passage select', { chars: text.length, rect })
          setPassagePayload({ text, cfi })
          setWordPayload(null)
          setPillAnchor(rect)
          setPillMode('passage')
          haptic.light()
        }}
        onTap={() => {
          // Tap on empty area: dismiss any active pill first; if no pill
          // was up, that tap is a chrome toggle instead.
          if (pillMode) {
            dismissPill()
          } else {
            toggleChrome()
          }
        }}
        onPassageCommentTapped={(cfi, passageText) => {
          if (!cfi) return
          setCommentSheet({ cfi, passageText })
        }}
      />

      {readerState === 'loading' ? (
        <View
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center"
          style={{ backgroundColor: themeColors.background }}
        >
          <ActivityIndicator color={colors.brandUi} />
          <Text
            className="font-ui mt-3 text-sm"
            style={{ color: themeColors.text, opacity: 0.7 }}
          >
            Loading book…
          </Text>
        </View>
      ) : null}

      {readerState === 'error' ? (
        <View
          className="absolute inset-0 items-center justify-center px-6"
          style={{ backgroundColor: themeColors.background }}
        >
          <View className="flex-row items-center gap-2 mb-3">
            <XIcon color={colors.error} size={20} />
            <Text
              className="font-ui-medium text-lg text-center"
              style={{ color: themeColors.text }}
            >
              We couldn't open this book.
            </Text>
          </View>
          <Text
            className="font-ui text-sm mb-6 text-center"
            style={{ color: themeColors.text, opacity: 0.7 }}
          >
            {readerError}
          </Text>
          <Pressable onPress={() => router.back()} className="flex-row items-center">
            <CaretLeft color={colors.brandUi} size={18} />
            <Text className="font-ui text-base ml-1" style={{ color: colors.brandUi }}>
              Back to library
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* TOP CHROME BAR, Back · title · Aa · ☰ · bookmark. rgba background
          (not the opacity prop) keeps icons + text fully opaque while the
          bar itself stays semi-translucent. Border-bottom separates it
          from the canvas regardless of how close the colors are. */}
      {chrome ? (
        <ReaderTopBar
          chromeBg={chromeBg}
          isTablet={isTablet}
          bookTitle={book.title}
          chapterTitle={currentChapter.title}
          isCurrentBookmarked={isCurrentBookmarked}
          onBack={() => router.back()}
          onOpenGoTo={() => setGoToOpen(true)}
          onOpenSettings={() => setShowSettings(true)}
          onBookmarkTap={onBookmarkTap}
        />
      ) : null}

      {/* BOTTOM CHROME BAR - Kindle-style: progress slider, chapter
          position, settings icon. Auto-hides with the top bar.
          The slider is visual-only for now (filled portion = progress
          fraction). Drag-to-jump needs a Readium goTo with totalProgression
          which is a separate piece of work. */}
      {chrome ? (
        <SafeAreaView
          edges={['bottom']}
          pointerEvents="box-none"
          className="absolute bottom-0 left-0 right-0"
        >
          <View
            style={{
              backgroundColor: chromeBg,
              borderTopWidth: 1,
              borderTopColor: colors.borderSubtle,
              paddingHorizontal: isTablet ? 24 : 16,
              paddingTop: isTablet ? 14 : 10,
              paddingBottom: isTablet ? 16 : 12,
            }}
          >
            <ProgressSlider
              value={progress}
              onSlidingComplete={(fraction) => {
                readerRef.current?.jumpToProgress(fraction)
              }}
            />
            <View
              className="flex-row items-center"
              style={{ marginTop: 8 }}
            >
              {matchingClubs.length > 0 ? (
                <Pressable
                  onPress={() => setClubPanelOpen(true)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`${matchingClubs[0].name} club panel`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 2,
                    paddingHorizontal: 8,
                    borderRadius: 999,
                    backgroundColor: colors.bgSelected,
                    marginRight: 8,
                  }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: colors.brandSubtle,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.display,
                        fontSize: 9,
                        color: colors.brandSubtleText,
                      }}
                    >
                      {(matchingClubs[0].name[0] ?? '?').toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 11,
                      color: colors.brandText,
                    }}
                  >
                    {presence.length > 0
                      ? `${presence.length} reading`
                      : 'Club'}
                  </Text>
                </Pressable>
              ) : null}
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontFamily: Fonts.ui,
                  fontSize: 12,
                  color: colors.textSecondary,
                }}
              >
                {currentChapter.title
                  ? `${currentChapter.title} · ${Math.round(progress * 100)}%`
                  : `${Math.round(progress * 100)}%`}
              </Text>
              {sleepTimer ? (
                <View
                  style={{
                    marginRight: 8,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: colors.bgSelected,
                  }}
                  accessibilityLabel="Sleep timer active"
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 11,
                      color: colors.brandText,
                    }}
                  >
                    {sleepTimer.kind === 'end_of_chapter'
                      ? 'EOC'
                      : sleepRemainingMs != null
                        ? formatRemaining(sleepRemainingMs)
                        : sleepTimer.kind === 'minutes'
                          ? `${sleepTimer.minutes}:00`
                          : ''}
                  </Text>
                </View>
              ) : null}
              {isPdf ? (
                <View
                  style={{
                    marginRight: 8,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: colors.bgSelected,
                  }}
                  accessibilityLabel="PDF mode"
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 9,
                      color: colors.brandText,
                      letterSpacing: 0.6,
                    }}
                  >
                    PDF
                  </Text>
                </View>
              ) : null}
              {/* Companion button (Phase 1 stub). Opens the existing This
                  Chapter grid plus the Story So Far / Characters / Search
                  tools; becomes the hub in Phase 3. */}
              <Pressable
                onPress={() => {
                  setMenuInitialView('chapter-features')
                  setMenuOpen(true)
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Companion"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  marginRight: 6,
                  borderRadius: 999,
                  backgroundColor: colors.bgSelected,
                }}
              >
                <Sparkle color={colors.brandText} size={16} />
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 12,
                    color: colors.brandText,
                    marginLeft: 4,
                  }}
                >
                  Companion
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMenuInitialView('secondary')
                  setMenuOpen(true)
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="More actions"
                style={{ paddingHorizontal: 6, paddingVertical: 4 }}
              >
                <CaretUp color={colors.brandUi} size={20} weight="regular" />
              </Pressable>
            </View>
            {presence.length > 0 ? (
              <Pressable
                onPress={() => {
                  if (matchingClubs.length > 0) {
                    router.push(`/clubs/${matchingClubs[0].club_id}` as never)
                  }
                }}
                className="flex-row items-center"
                style={{ marginTop: 8 }}
                accessibilityLabel="Club members reading now"
              >
                {presence.map((p, i) => {
                  const initial = (p.display_name ?? '?')[0]?.toUpperCase() ?? '?'
                  return (
                    <View
                      key={p.user_id}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        overflow: 'hidden',
                        backgroundColor: colors.brandSubtle,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1.5,
                        borderColor: chromeBg,
                        marginLeft: i === 0 ? 0 : -8,
                      }}
                    >
                      {p.avatar_url ? (
                        <Image
                          source={{ uri: p.avatar_url }}
                          style={{ width: '100%', height: '100%' }}
                        />
                      ) : (
                        <Text
                          style={{
                            fontFamily: Fonts.display,
                            fontSize: 11,
                            color: colors.brandSubtleText,
                          }}
                        >
                          {initial}
                        </Text>
                      )}
                    </View>
                  )
                })}
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
      ) : null}

      {/* Floating pill rendered AFTER chrome so it sits on top, when the
          pill is anchored near the top or bottom of the screen, it can't
          be hidden behind the chrome bar. */}
      <FloatingPill
        visible={pillMode !== null}
        mode={pillMode ?? 'word'}
        anchor={pillAnchor}
        onDismiss={dismissPill}
        onLookup={handleLookup}
        onAnalyze={handleAnalyze}
        onAsk={handleAsk}
        onTranslate={handleTranslate}
        showClub={matchingClubs.length > 0}
        onClub={() => {
          if (!passagePayload?.cfi) {
            setToast("Selection needs a position, try selecting again.")
            dismissPill()
            return
          }
          setCommentSheet({
            cfi: passagePayload.cfi,
            passageText: passagePayload.text,
          })
          dismissPill()
        }}
        onHighlight={handleHighlight}
      />

      <ReaderToast message={toast} onHide={() => setToast(null)} />

      {/* Chapter reaction, slides up after a chapter ends. Replaces the
          comprehension check-in per task.md Section H4. */}
      <ChapterReactionSheet
        visible={!!checkinChapter}
        chapterTitle={checkinChapter ?? ''}
        onSave={async (emoji, note, privacy: PrivacyTier) => {
          const chapter = checkinChapter
          setCheckinChapter(null)
          if (!chapter) return
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user && book) {
              await supabase.from('chapter_reactions').insert({
                user_id: user.id,
                book_id: book.id,
                chapter_name: chapter,
                emoji,
                note: note || null,
                privacy,
              })
            }
          } catch (e) {
            console.warn('[reader] chapter_reactions insert failed:', e instanceof Error ? e.message : e)
          }
        }}
        onDismiss={() => setCheckinChapter(null)}
      />

      <TypographySheet
        visible={showSettings}
        prefs={prefs}
        userId={userId}
        bookId={book.id}
        bookTitle={book.title}
        bookAuthor={book.author}
        sidePanel={isTablet}
        onChangePrefs={changePrefs}
        onClose={() => setShowSettings(false)}
      />

      {wordSheet ? (
        <WordLookupSheet
          visible
          word={wordSheet.word}
          sentence={wordSheet.surroundingText}
          bookTitle={book.title}
          bookId={book.id}
          author={book.author}
          era=""
          currentChapter={currentChapter.title}
          progress={progress}
          onClose={() => setWordSheet(null)}
        />
      ) : null}

      {passageSheet ? (
        <PassageAnalysisSheet
          visible
          passage={passageSheet.text}
          bookTitle={book.title}
          author={book.author}
          era=""
          bookId={book.id}
          currentChapter={currentChapter.title}
          progress={progress}
          cfi={passageSheet.cfi}
          onClose={() => setPassageSheet(null)}
        />
      ) : null}

      <ChapterSummaryModal
        visible={summaryOpen}
        chapterTitle={currentChapter.title || book.title}
        chapterNumber={currentChapter.index || 1}
        bookTitle={book.title}
        author={book.author}
        timing="after"
        bookId={book.id}
        progress={progress}
        onClose={() => setSummaryOpen(false)}
      />

      <CompanionChat
        visible={chatOpen}
        bookTitle={book.title}
        author={book.author}
        currentChapter={currentChapter.title || 'the current chapter'}
        bookId={book.id}
        progress={progress}
        seedAssistantMessage={chatSeed}
        onClose={() => {
          setChatOpen(false)
          setChatSeed(null)
        }}
      />

      <MenuSheet
        visible={menuOpen}
        bookTitle={book.title}
        bookAuthor={book.author}
        currentChapterTitle={currentChapter.title}
        initialView={menuInitialView}
        clubsReadingThis={matchingClubs}
        onAction={handleMenuAction}
        onChapterFeature={(kind) => setChapterFeature(kind)}
        onClose={() => setMenuOpen(false)}
      />

      {matchingClubs.length > 0 ? (
        <ClubPanelSheet
          visible={clubPanelOpen}
          club={matchingClubs[0]}
          bookId={book.id}
          bookTitle={book.title}
          viewerClubIds={matchingClubs.map((c) => c.club_id)}
          onOpenComment={(c: PassageComment) => {
            setCommentSheet({ cfi: c.cfi, passageText: c.passage_text ?? '' })
            setClubPanelOpen(false)
          }}
          onClose={() => setClubPanelOpen(false)}
        />
      ) : null}

      <ChapterFeatureSheet
        visible={chapterFeature !== null}
        kind={chapterFeature}
        bookTitle={book.title}
        author={book.author}
        chapterTitle={currentChapter.title}
        bookId={book.id}
        progress={progress}
        onClose={() => setChapterFeature(null)}
      />

      <CharacterMapSheet
        visible={characterMapOpen}
        bookTitle={book.title}
        bookId={book.id}
        author={book.author}
        currentChapter={currentChapter.title}
        progress={progress}
        onClose={() => setCharacterMapOpen(false)}
      />

      <HighlightsSheet
        visible={highlightsOpen}
        bookTitle={book.title}
        bookAuthor={book.author}
        bookId={book.id}
        onNavigate={(cfi, text, chapter) =>
          readerRef.current?.goTo(cfi, { text, chapter: chapter ?? undefined })
        }
        onClose={() => setHighlightsOpen(false)}
      />

      <SearchSheet
        visible={searchOpen}
        bookTitle={book.title}
        bookId={book.id}
        author={book.author}
        chapterList={chapterList}
        // Exact search not yet wired through to foliate, sheet shows a
        // "coming soon" message in that mode. AI Search routes by
        // chapter name; we treat that as a no-op for now since we don't
        // have a chapter-name → CFI map yet (a follow-up).
        onClose={() => setSearchOpen(false)}
      />

      {translateSel ? (
        <TranslateSheet
          visible
          paragraphs={translateSel.paragraphs}
          targetLanguage={prefs.targetLanguage}
          bookTitle={book.title}
          author={book.author}
          bookId={book.id}
          currentChapter={currentChapter.title}
          onClose={() => setTranslateSel(null)}
        />
      ) : null}

      {commentSheet ? (
        <PassageCommentSheet
          visible
          bookId={book.id}
          cfi={commentSheet.cfi}
          passageText={commentSheet.passageText}
          clubs={matchingClubs}
          onClose={() => setCommentSheet(null)}
        />
      ) : null}

      <SleepTimerSheet
        visible={sleepSheetOpen}
        active={sleepTimer}
        onPick={onPickSleepOption}
        onClose={() => setSleepSheetOpen(false)}
      />

      <GoToSheet
        visible={goToOpen}
        bookId={book.id}
        currentProgress={progress}
        loadToc={() =>
          (readerRef.current?.getToc?.() ?? Promise.resolve([])).then((items) =>
            (items ?? []).map((it) => ({ label: it.label, href: it.href, cfi: it.cfi })),
          )
        }
        loadHistory={() => Promise.resolve(positionHistoryRef.current)}
        onClearHistory={async () => {
          if (!book) return
          positionHistoryRef.current = []
          await clearPositionHistory(book.id)
        }}
        onNavigateCfi={(cfi) => readerRef.current?.goTo(cfi)}
        onNavigatePercent={(p) => {
          // foliate-view doesn't expose a direct "go to percentage" API;
          // for v1 we no-op with a toast so users know it's coming.
          console.log('[reader] goTo percent (not yet wired):', p)
          setToast('Jump-to-percent lands in the next reader build.')
        }}
        onNavigateHref={(href) => {
          // The renderer accepts hrefs directly via goTo when CFI isn't
          // available on a TOC entry. Falls back to logging if foliate
          // doesn't recognize it.
          readerRef.current?.goTo(href)
        }}
        onClose={() => setGoToOpen(false)}
      />

      <TtsBar
        visible={ttsOpen}
        chapterText={ttsText}
        onCurrentSentence={(index) => {
          readerRef.current?.highlightSentence(index)
        }}
        onClose={() => {
          setTtsOpen(false)
          readerRef.current?.highlightSentence(null)
        }}
      />

      {bookmarkPrompt ? (
        <BookmarkNamingModal
          suggested={bookmarkPrompt.suggestedName}
          onCancel={() => setBookmarkPrompt(null)}
          onSave={async (name) => {
            if (!book) return
            const row = await createBookmark({
              bookId: book.id,
              cfi: bookmarkPrompt.cfi,
              name: name || bookmarkPrompt.suggestedName,
            })
            if (row) {
              setBookmarkCfis((s) => new Set(s).add(row.cfi))
              setToast('Bookmark saved.')
            } else {
              setToast("Couldn't save bookmark.")
            }
            setBookmarkPrompt(null)
          }}
        />
      ) : null}
    </View>
  )
}

// Inline modal for naming a fresh bookmark. Defaults to "[Chapter] · X%"
// so a confused user can just hit Save without typing anything.
function BookmarkNamingModal({
  suggested,
  onCancel,
  onSave,
}: {
  suggested: string
  onCancel: () => void
  onSave: (name: string) => void | Promise<void>
}) {
  const colors = useColors()
  const [name, setName] = useState(suggested)
  return (
    <RNModal visible animationType="fade" transparent onRequestClose={onCancel}>
      <Pressable
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: colors.overlay }}
        onPress={onCancel}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full p-4 rounded-2xl bg-bg-elevated-light dark:bg-bg-elevated-dark"
        >
          <Text
            style={{
              fontFamily: Fonts.displayBold,
              fontSize: 16,
              color: colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Name this bookmark
          </Text>
          <RNTextInput
            value={name}
            onChangeText={setName}
            placeholder={suggested}
            placeholderTextColor={colors.textTertiary}
            maxLength={80}
            autoFocus
            style={{
              fontFamily: Fonts.body,
              fontSize: 15,
              color: colors.textPrimary,
              backgroundColor: colors.bgBase,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 12,
            }}
          />
          <View className="flex-row justify-end gap-3">
            <Pressable onPress={onCancel} className="px-4 py-2">
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textSecondary }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(name.trim() || suggested)}
              className="px-4 py-2 rounded-full"
              style={{ backgroundColor: colors.brandUi }}
            >
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                Save
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </RNModal>
  )
}
