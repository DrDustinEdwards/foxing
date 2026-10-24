import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator, AppState, PanResponder, TextInput, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  CaretLeft,
  CaretUp,
  Sparkle,
  X as XIcon,
} from 'phosphor-react-native'
import { TtsBar } from '@/components/reader/tts-bar'
import { GoToSheet } from '@/components/reader/go-to-sheet'
import { ReaderTopBar } from '@/components/reader/reader-top-bar'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import type {
  PassageCommentMarker,
  ReaderRect,
  ReaderRef,
  ReaderSettings,
} from '@/components/reader/foliate-reader-webview'
import { ReadiumReader } from '@/components/reader/readium-reader'
import { PassageCommentSheet } from '@/components/reader/passage-comment-sheet'
import { TypographySheet } from '@/components/reader/typography-sheet'
import { WordLookupSheet } from '@/components/reader/word-lookup-sheet'
import { PassageAnalysisSheet } from '@/components/reader/passage-analysis-sheet'
import { CompanionChat } from '@/components/reader/companion-chat'
import {
  COMPANION_TOOL_TITLES,
  type CompanionTool,
  MenuSheet,
  type MenuAction,
  type MenuInitialView,
} from '@/components/reader/menu-sheet'
import { CompanionSheet } from '@/components/reader/companion-sheet'
import { ClubPanelSheet } from '@/components/reader/club-panel-sheet'
import { ProgressSlider } from '@/components/reader/progress-slider'
import { SleepTimerSheet, type SleepTimerOption } from '@/components/reader/sleep-timer-sheet'
import { privacyToVisibility, type PrivacyTier } from '@/components/privacy-selector'
import { HighlightsSheet } from '@/components/reader/highlights-sheet'
import { UpgradeSheet } from '@/components/reader/upgrade-sheet'
import {
  FloatingPill,
  type HighlightColor,
  type PillAnchor,
  type PillMode,
} from '@/components/reader/floating-pill'
import {
  type ReaderPrefs,
  DEFAULT_PREFS,
  loadPrefs,
  savePrefs,
} from '@/lib/reader-settings'
import { haptic } from '@/lib/haptics'
import { authClient } from '@/lib/api'
import { useBookmarks, useReaderWrites } from '@/lib/reader-data'
import { useBookAnnotations, useClubLive, useMe, useMyBook, useReaderPage } from '@foxing/client'
import { decodeLocator, encodeLocator } from '@/components/reader/readium-helpers'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  appendEntry as appendHistoryEntry,
  clearHistory as clearPositionHistory,
  loadHistory as loadPositionHistory,
  saveHistory as savePositionHistory,
  type PositionEntry,
} from '@/lib/position-history'
import { BookmarkNamingModal, ReaderToast } from '@/components/reader/reader-overlays'
import { CANVAS_PALETTE, formatRemaining, hexToRgba, prefsToSettings } from '@/components/reader/reader-screen-helpers'

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

export default function Reader() {
  const colors = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  // iPad-class width threshold. 768pt is iPad-portrait / common 10" tablet
  // width; below that we treat the device as a phone for layout purposes.
  const { width: windowWidth } = useWindowDimensions()
  const isTablet = windowWidth >= 768
  const readerRef = useRef<ReaderRef>(null)
  // Start of the reading stretch not yet logged as a session (see logStretch).
  const stretchStartRef = useRef<number>(Date.now())
  const positionRef = useRef<{ cfi: string | null; percentage: number }>({
    cfi: null,
    percentage: 0,
  })
  const lastSaveRef = useRef<number>(Date.now())
  const chromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const readerPage = useReaderPage(id ?? '')
  const book = readerPage.data?.book ?? null
  const session = authClient.useSession()
  const userId = session.data?.user.id ?? null
  const me = useMe(undefined, !!userId)
  const myBook = useMyBook(book?.id ?? '', undefined, !!userId && !!book)
  const layers = useBookAnnotations(book?.id ?? '')
  const writes = useReaderWrites(book?.id ?? null)
  const writesRef = useRef(writes)
  writesRef.current = writes
  // PDFs are detected by URL extension. We only need to gate features that
  // don't translate cleanly: the word tap pill relies on text-flow chunks.
  const isPdf = !!book && /\.pdf(\?|#|$)/i.test(book.epubUrl)
  // The saved position is read once, when the book first loads.
  const [initialCfi, setInitialCfi] = useState<string | null>(null)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [readerState, setReaderState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [readerError, setReaderError] = useState<string | null>(null)
  const [chrome, setChrome] = useState(false)

  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS)
  // Subscription tier for client-side Plus gating of AI actions. Unknown (still
  // loading) does not block: the server remains the authoritative gate. 'free'
  // shows the lock + upgrade prompt; 'plus' is ungated.
  const subscriptionTier = me.data?.profile?.subscriptionTier ?? null
  // When set, the upgrade prompt is shown; the string is the feature name for
  // the headline (e.g. "Translate").
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null)
  const locked = subscriptionTier === 'free'
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
  const [highlightsOpen, setHighlightsOpen] = useState(false)
  // A companion tool from the menu (characters, this chapter, ...), shown as one answer.
  const [companionTool, setCompanionTool] = useState<CompanionTool | null>(null)
  // The question typed into the Find tool; it waits until the reader submits one.
  const [findQuery, setFindQuery] = useState('')
  const [findSubmitted, setFindSubmitted] = useState<string | null>(null)
  // Translate sheet: the selected word or passage, translated into prefs.targetLanguage.
  const [translateText, setTranslateText] = useState<string | null>(null)
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
  // Inline bookmark naming modal, shown when the chrome bookmark button
  // is tapped on a position that doesn't have a bookmark yet.
  const [bookmarkPrompt, setBookmarkPrompt] = useState<{ cfi: string; suggestedName: string } | null>(null)

  // Live WPM tracking. Each location change with pageWordCount lets us
  // compute words/sec from the previous sample → smooth into a session
  // average for the bottom-bar reading-rate indicator.
  const lastLocationTimeRef = useRef<number>(Date.now())
  const lastPageWordsRef = useRef<number>(0)
  const wpmSamplesRef = useRef<number[]>([])
  // Page turns in the stretch not yet logged as a session.
  const pagesReadRef = useRef<number>(0)
  const [wpm, setWpm] = useState<number | null>(null)

  // Transient toast, currently used for "couldn't save highlight" feedback.
  const [toast, setToast] = useState<string | null>(null)

  // This book's bookmarks, from the cached annotation layers; drives the filled
  // vs outline bookmark icon in the top chrome without a per-page-turn lookup.
  const { bookmarks } = useBookmarks(book?.id ?? null)
  const bookmarkCfis = useMemo(() => new Set(bookmarks.map((b) => b.cfi)), [bookmarks])
  const isCurrentBookmarked = useMemo(
    () => !!(positionRef.current.cfi && bookmarkCfis.has(positionRef.current.cfi)),
    // Re-evaluate when progress changes since positionRef is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookmarkCfis, progress],
  )

  // Clubs the viewer belongs to that are currently reading THIS book. Empty
  // = no Club button on the pill, no margin dots.
  const matchingClubs = readerPage.data?.shareableClubs ?? []

  // Sheet state, single sheet that handles both "tapped margin dot" and
  // "tapped Club button on the pill". The pill path comes in with the
  // selected passage; the dot path comes in with the commented passage.
  const [commentSheet, setCommentSheet] = useState<{
    cfi: string
    passageText: string
  } | null>(null)

  // Club presence in the bottom chrome: members of the first matching club who
  // are in the club right now (its live socket), not counting the viewer.
  const live = useClubLive(matchingClubs[0]?.id ?? null)
  const presence = live.presence.filter((u) => u !== userId)

  // The set-interval / cleanup paths fire saveProgress on a stale closure
  // (book is null at first render). Route through a ref so they always
  // call the latest version that closes over the current `book`.
  const saveProgressRef = useRef<() => void>(() => {})

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

  // Paint the reader's own highlights once the book is open, and again when they change.
  useEffect(() => {
    if (readerState !== 'ready') return
    for (const m of layers.data?.mine ?? []) {
      if (m.type === 'highlight' && m.locator) {
        readerRef.current?.addHighlight(encodeLocator(m.locator), (m.color ?? 'amber') as HighlightColor)
      }
    }
  }, [readerState, layers.data?.mine])

  // Popular highlights, gated on the prefs toggle: passages at least three readers
  // highlighted, from the book's annotation layers.
  useEffect(() => {
    if (readerState !== 'ready') return
    if (!prefs.popularHighlightsEnabled) {
      readerRef.current?.setPopularHighlights([])
      return
    }
    const list = (layers.data?.popular ?? [])
      .filter((p) => p.count >= 3 && p.locator)
      .map((p) => ({ text: p.normalizedText, cfi: encodeLocator(p.locator!), count: p.count }))
    readerRef.current?.setPopularHighlights(list, colors.textTertiary)
  }, [readerState, layers.data?.popular, prefs.popularHighlightsEnabled, colors.textTertiary])

  // Club passage comments as margin dots.
  useEffect(() => {
    if (readerState !== 'ready') return
    const markers: PassageCommentMarker[] = (layers.data?.comments ?? [])
      .filter((c) => !c.parentId && c.locator)
      .map((c) => ({ cfi: encodeLocator(c.locator!), passageText: (c.locator?.text as { highlight?: string } | undefined)?.highlight ?? '' }))
    readerRef.current?.setPassageComments(markers, colors.brandUi)
  }, [readerState, layers.data?.comments, colors.brandUi])

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

  // Once the book loads: open at the saved place, and put the book on the Reading shelf
  // if it isn't there yet (finished and paused books stay where they are, so opening
  // a finished book to look something up doesn't bounce it back).
  const opened = useRef(false)
  useEffect(() => {
    if (!readerPage.data || opened.current) return
    if (userId && myBook.isPending) return
    opened.current = true
    const saved = readerPage.data.initialLocator
    if (saved) setInitialCfi(encodeLocator(saved))
    if (myBook.data?.progressPct) setProgress(myBook.data.progressPct / 100)
    const status = myBook.data?.status ?? null
    if (userId && (!status || status === 'want' || status === 'abandoned')) {
      writes.saveBook({ status: 'reading', ...(myBook.data?.startedAt ? {} : { startedAt: Date.now() }) })
    }
  }, [readerPage.data, userId, myBook.isPending, myBook.data, writes])

  // Reader prefs, per user (falls back to an anonymous key when signed out).
  useEffect(() => {
    if (session.isPending) return
    let mounted = true
    loadPrefs(userId).then((loaded) => {
      if (!mounted) return
      setPrefs(loaded)
      setPrefsLoaded(true)
    })
    return () => {
      mounted = false
    }
  }, [userId, session.isPending])

  // Position and reading stretches are queued on the device (they survive a crash
  // or no signal) through refs, so the timers always see the latest values. A stretch
  // is logged every five minutes, when the app leaves the foreground, and on close;
  // coming back to the front starts a new one.
  useEffect(() => {
    const t = setInterval(() => {
      saveProgressRef.current()
      logStretch()
    }, 5 * 60_000)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        stretchStartRef.current = Date.now()
        return
      }
      saveProgressRef.current()
      logStretch()
    })
    return () => {
      clearInterval(t)
      sub.remove()
      saveProgressRef.current()
      logStretch()
    }
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

  const toggleChrome = useCallback(() => setChrome((v) => !v), [])

  function saveProgress() {
    if (!book || !userId || !positionRef.current.cfi) return
    const locator = decodeLocator(positionRef.current.cfi)
    if (!locator) return
    writesRef.current.saveBook({
      progress: locator as unknown as Record<string, unknown>,
      progressPct: Math.round(positionRef.current.percentage * 1000) / 10,
    })
  }

  // Keep the ref pointed at the current-render saveProgress so the timers
  // started in the mount effect always invoke the freshest closure.
  saveProgressRef.current = saveProgress

  // Logs the stretch since the last one as a reading session (sessions are append-only,
  // and the server counts the day toward the streak). Reads refs only, so the
  // mount-effect timers can call it. A stretch with no page turns is not reading.
  function logStretch() {
    const startedAt = stretchStartRef.current
    const pagesRead = pagesReadRef.current
    stretchStartRef.current = Date.now()
    pagesReadRef.current = 0
    if (pagesRead === 0) return
    const samples = wpmSamplesRef.current
    writesRef.current.logSession({
      startedAt,
      endedAt: Date.now(),
      pagesRead,
      avgWpm: samples.length > 0 ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : null,
      lastWpm: samples.length > 0 ? Math.round(samples[samples.length - 1]) : null,
    })
  }

  function onLocation(cfi: string, percentage: number, pageWordCount?: number) {
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

    // Save the place at most every 5 seconds of page turning.
    if (Date.now() - lastSaveRef.current >= 5000) {
      lastSaveRef.current = Date.now()
      saveProgress()
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

  function handleHighlight(color: HighlightColor, privacy: PrivacyTier = 'public') {
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
    if (!userId) {
      dismissPill()
      return
    }
    writes.addAnnotation({
      type: 'highlight',
      locator: decodeLocator(cfi) as unknown as Record<string, unknown>,
      selectedText: text,
      color,
      chapter: currentChapter.title || null,
      visibility: privacyToVisibility(privacy),
    })
    readerRef.current?.addHighlight(cfi, color)
    haptic.light()
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
      setChatSeed(`In "${wordPayload.surroundingText}", what does "${wordPayload.word}" mean? `)
      setChatOpen(true)
      dismissPill()
      return
    }
    if (passagePayload) {
      setChatSeed(`About this passage: "${passagePayload.text}" `)
      setChatOpen(true)
      dismissPill()
      return
    }
    dismissPill()
  }

  // Translate the current selection into the reader's saved target language
  // (prefs.targetLanguage).
  function handleTranslate() {
    const raw = pillMode === 'word' ? wordPayload?.word : passagePayload?.text
    if (raw) setTranslateText(raw)
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
      case 'character_map':
      case 'book_insight':
      case 'semantic_search':
      case 'chapter_feature':
      case 'deep_dive':
      case 'discussion_starter':
        setFindQuery('')
        setFindSubmitted(null)
        setCompanionTool(action)
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
          router.push(`/clubs/${matchingClubs[0].id}` as never)
        }
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
  const onBookmarkTap = useCallback(() => {
    const cfi = positionRef.current.cfi
    if (!cfi || !book) {
      setToast("Couldn't read the current position. Try turning the page.")
      return
    }
    const existing = bookmarks.find((b) => b.cfi === cfi)
    if (existing) {
      writes.removeAnnotation(existing.id)
      setToast('Bookmark removed.')
      return
    }
    haptic.light()
    const suggested = `${currentChapter.title || 'Bookmark'} · ${Math.round(progress * 100)}%`
    setBookmarkPrompt({ cfi, suggestedName: suggested })
  }, [book, bookmarks, writes, currentChapter.title, progress])

  if (readerPage.isPending || !prefsLoaded) {
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
        epubUrl={book.epubUrl}
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
            // End-of-chapter sleep mode fires once on the next real
            // transition. Wait until after the state update so the user
            // sees the new chapter momentarily before we save + navigate.
            if (sleepTimer?.kind === 'end_of_chapter') {
              expireSleepTimer()
            }
          }
          previousChapterRef.current = c.title
          setCurrentChapter({ title: c.title, index: 0 })
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
              {/* Chapter label on the left, a prominent percent read-out on
                  the right so progress is legible at a glance. Streaks are
                  intentionally not shown here: reading_streaks recording is an
                  unverified device bug, so we surface progress only. */}
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontFamily: Fonts.ui,
                  fontSize: 12,
                  color: colors.textSecondary,
                }}
              >
                {currentChapter.title || 'Progress'}
              </Text>
              <Text
                accessibilityLabel={`${Math.round(progress * 100)} percent read`}
                style={{
                  fontFamily: Fonts.monoMedium,
                  fontSize: 12,
                  color: colors.brandText,
                  marginRight: 8,
                }}
              >
                {Math.round(progress * 100)}%
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
                  book and chapter tools. */}
              <Pressable
                onPress={() => {
                  setMenuInitialView('companion')
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
        locked={locked}
        onUpgrade={(feature) => setUpgradeFeature(feature)}
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

      <TypographySheet
        visible={showSettings}
        prefs={prefs}
        userId={userId}
        bookId={book.id}
        sidePanel={isTablet}
        onChangePrefs={changePrefs}
        onClose={() => setShowSettings(false)}
      />

      {wordSheet ? (
        <WordLookupSheet
          visible
          word={wordSheet.word}
          sentence={wordSheet.surroundingText}
          bookId={book.id}
          currentChapter={currentChapter.title}
          onSaveWord={writes.saveWord}
          onClose={() => setWordSheet(null)}
        />
      ) : null}

      {passageSheet ? (
        <PassageAnalysisSheet
          visible
          passage={passageSheet.text}
          bookId={book.id}
          currentChapter={currentChapter.title}
          onSavePassage={() =>
            writes.addAnnotation({
              type: 'commonplace',
              locator: passageSheet.cfi ? (decodeLocator(passageSheet.cfi) as unknown as Record<string, unknown>) : null,
              selectedText: passageSheet.text.slice(0, 4000),
              chapter: currentChapter.title || null,
            })
          }
          onClose={() => setPassageSheet(null)}
        />
      ) : null}

      <CompanionChat
        visible={chatOpen}
        bookTitle={book.title}
        bookId={book.id}
        seedQuestion={chatSeed}
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
        locked={locked}
        onUpgrade={(feature) => setUpgradeFeature(feature)}
        onClose={() => setMenuOpen(false)}
      />

      {matchingClubs.length > 0 ? (
        <ClubPanelSheet
          visible={clubPanelOpen}
          club={matchingClubs[0]}
          bookId={book.id}
          bookTitle={book.title}
          onOpenComment={(c) => {
            if (c.locator) setCommentSheet({ cfi: encodeLocator(c.locator), passageText: '' })
            setClubPanelOpen(false)
          }}
          onClose={() => setClubPanelOpen(false)}
        />
      ) : null}

      <CompanionSheet
        visible={companionTool !== null}
        title={companionTool ? COMPANION_TOOL_TITLES[companionTool] : ''}
        eyebrow={companionTool === 'book_insight' ? book.title : currentChapter.title || null}
        request={
          !companionTool
            ? null
            : companionTool === 'semantic_search'
              ? findSubmitted
                ? { action: 'semantic_search', bookId: book.id, message: findSubmitted }
                : null
              : { action: companionTool, bookId: book.id, chapter: currentChapter.title || undefined }
        }
        onClose={() => setCompanionTool(null)}
      >
        {companionTool === 'semantic_search' ? (
          <TextInput
            value={findQuery}
            onChangeText={setFindQuery}
            onSubmitEditing={() => setFindSubmitted(findQuery.trim() || null)}
            placeholder="Describe a moment, an idea or a line"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
            accessibilityLabel="What are you looking for in the book?"
            style={{
              fontFamily: Fonts.body,
              fontSize: 15,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 14,
            }}
          />
        ) : null}
      </CompanionSheet>

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

      <CompanionSheet
        visible={translateText !== null}
        title={`Translate to ${prefs.targetLanguage}`}
        request={
          translateText
            ? {
                action: 'bilingual_paragraph',
                bookId: book.id,
                selection: { text: translateText.slice(0, 4000), chapter: currentChapter.title || null },
                targetLanguage: prefs.targetLanguage,
              }
            : null
        }
        onClose={() => setTranslateText(null)}
      />

      <UpgradeSheet
        visible={upgradeFeature !== null}
        feature={upgradeFeature ?? undefined}
        onClose={() => setUpgradeFeature(null)}
      />

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
          onSave={(name) => {
            writes.addAnnotation({
              type: 'bookmark',
              locator: decodeLocator(bookmarkPrompt.cfi) as unknown as Record<string, unknown>,
              body: name || bookmarkPrompt.suggestedName,
              chapter: currentChapter.title || null,
            })
            setToast('Bookmark saved.')
            setBookmarkPrompt(null)
          }}
        />
      ) : null}
    </View>
  )
}

