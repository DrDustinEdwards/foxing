import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft, TextAa, List as ListIcon, BookmarkSimple, X as XIcon } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { Colors, useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  FoliateReaderWebView,
  type ReaderRect,
  type ReaderRef,
  type ReaderSettings,
} from '@/components/reader/foliate-reader-webview'
import { TypographySheet } from '@/components/reader/typography-sheet'
import { WordLookupSheet } from '@/components/reader/word-lookup-sheet'
import { PassageAnalysisSheet } from '@/components/reader/passage-analysis-sheet'
import { ChapterSummaryModal } from '@/components/reader/chapter-summary-modal'
import { CompanionChat } from '@/components/reader/companion-chat'
import { MenuSheet, type MenuAction } from '@/components/reader/menu-sheet'
import { CharacterMapSheet } from '@/components/reader/character-map-sheet'
import { HighlightsSheet } from '@/components/reader/highlights-sheet'
import { SearchSheet } from '@/components/reader/search-sheet'
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
  MARGIN_PX,
  PARAGRAPH_SPACING_EM,
  FONT_FAMILY_CSS,
} from '@/lib/reader-settings'
import { getWordWiseHints } from '@/lib/claude'
import { resolvePreferredEpubUrl } from '@/lib/books'

interface BookRow {
  id: string
  title: string
  author: string
  source: string
  epub_url: string
}

// Reading canvas modes are decoupled from the app's UI theme — they're
// applied to the WebView body (and via setStyles to each chapter iframe).
const CANVAS_PALETTE: Record<CanvasTheme, { background: string; text: string }> = {
  default: { background: Colors.light.bgReading, text: Colors.light.textPrimary },
  sepia: { background: Colors.light.bgReadingSepia, text: Colors.light.textOnSepia },
  dark: { background: Colors.dark.bgReading, text: Colors.dark.textPrimary },
  oled: { background: Colors.dark.bgReadingOled, text: Colors.dark.textOnDark },
}

// Project a ReaderPrefs (step-space, persistent) into the flat ReaderSettings
// the WebView consumes (concrete pixel/multiplier values).
function prefsToSettings(prefs: ReaderPrefs): ReaderSettings {
  const palette = CANVAS_PALETTE[prefs.canvasTheme]
  return {
    fontSize: FONT_SIZE_PX[prefs.fontSize],
    lineHeight: LINE_SPACING_VAL[prefs.lineSpacing],
    theme: palette,
    fontFamily: FONT_FAMILY_CSS[prefs.fontFamily],
    bold: prefs.bold,
    paragraphSpacing: PARAGRAPH_SPACING_EM[prefs.paragraphSpacing],
    marginPx: MARGIN_PX[prefs.marginWidth],
    justify: prefs.alignment === 'justified',
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

export default function Reader() {
  const colors = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const readerRef = useRef<ReaderRef>(null)
  const sessionIdRef = useRef<string | null>(null)
  const positionRef = useRef<{ cfi: string | null; percentage: number }>({
    cfi: null,
    percentage: 0,
  })
  const lastSaveRef = useRef<number>(Date.now())
  const chromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [book, setBook] = useState<BookRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialCfi, setInitialCfi] = useState<string | null>(null)
  const [readerState, setReaderState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [readerError, setReaderError] = useState<string | null>(null)
  const [chrome, setChrome] = useState(false)

  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS)
  const [userId, setUserId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const [currentChapter, setCurrentChapter] = useState({ title: '', index: 0 })
  const [progress, setProgress] = useState(0)

  // Floating pill state — anchored to a WebView-local rect. The pill itself
  // handles its own color-picker expansion; we just feed it mode + payload.
  const [pillMode, setPillMode] = useState<PillMode | null>(null)
  const [pillAnchor, setPillAnchor] = useState<PillAnchor | null>(null)
  const [wordPayload, setWordPayload] = useState<WordPillState | null>(null)
  const [passagePayload, setPassagePayload] = useState<PassagePillState | null>(null)

  // Sheet visibility — opened from pill actions or chrome buttons.
  const [wordSheet, setWordSheet] = useState<WordPillState | null>(null)
  const [passageSheet, setPassageSheet] = useState<PassagePillState | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatSeed, setChatSeed] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [characterMapOpen, setCharacterMapOpen] = useState(false)
  const [highlightsOpen, setHighlightsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Live WPM tracking. Each location change with pageWordCount lets us
  // compute words/sec from the previous sample → smooth into a session
  // average for the bottom-bar reading-rate indicator.
  const lastLocationTimeRef = useRef<number>(Date.now())
  const lastPageWordsRef = useRef<number>(0)
  const wpmSamplesRef = useRef<number[]>([])
  const [wpm, setWpm] = useState<number | null>(null)
  // Chapter list for the AI semantic search action — populated from
  // foliate's TOC if we can pull it; otherwise just the current chapter.
  const [chapterList, setChapterList] = useState<string[]>([])

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
      // the epub_url — book.id stays the row the user tapped, so their
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
          .select('progress_cfi, progress_percentage')
          .eq('user_id', user.id)
          .eq('book_id', bookData.id)
          .maybeSingle()
        if (ub?.progress_cfi) setInitialCfi(ub.progress_cfi)
        if (ub?.progress_percentage) setProgress(ub.progress_percentage)

        const { data: sess } = await supabase
          .from('reading_sessions')
          .insert({
            user_id: user.id,
            book_id: bookData.id,
            started_at: new Date().toISOString(),
          })
          .select('id')
          .single()
        if (sess) sessionIdRef.current = sess.id
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

  useEffect(() => {
    const t = setInterval(saveProgress, 30000)
    return () => {
      clearInterval(t)
      saveProgress()
      endSession()
    }
  }, [])

  // Auto-hide chrome 4s after it appears.
  useEffect(() => {
    if (chromeTimerRef.current) {
      clearTimeout(chromeTimerRef.current)
      chromeTimerRef.current = null
    }
    if (chrome) {
      chromeTimerRef.current = setTimeout(() => setChrome(false), 4000)
    }
    return () => {
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current)
    }
  }, [chrome])

  // Word Wise toggle → bridge. When disabled, the bridge clears any
  // already-injected hints; when enabled, the next onLocation triggers
  // the first fetch. We don't backfill the current page on toggle-on —
  // a single page turn brings hints in.
  useEffect(() => {
    if (readerState !== 'ready') return
    readerRef.current?.setWordWiseEnabled(prefs.wordWiseEnabled)
  }, [prefs.wordWiseEnabled, readerState])

  const toggleChrome = useCallback(() => setChrome((v) => !v), [])

  async function saveProgress() {
    if (!book || !positionRef.current.cfi) return
    if (Date.now() - lastSaveRef.current < 5000) return
    lastSaveRef.current = Date.now()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
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
  }

  async function endSession() {
    if (!sessionIdRef.current) return
    await supabase
      .from('reading_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionIdRef.current)
  }

  function onLocation(cfi: string, percentage: number, pageWordCount?: number, pageText?: string) {
    positionRef.current = { cfi, percentage }
    setProgress(percentage)
    // Update rolling WPM average. We use the previous page's word count
    // and the time delta — the new pageWordCount becomes "previous" on
    // the next call. First call seeds; can't compute WPM until call #2.
    const now = Date.now()
    const prevWords = lastPageWordsRef.current
    const elapsedSec = (now - lastLocationTimeRef.current) / 1000
    if (prevWords > 0 && elapsedSec > 5 && elapsedSec < 600) {
      const sample = (prevWords / elapsedSec) * 60
      if (sample > 30 && sample < 1500) {
        wpmSamplesRef.current = [...wpmSamplesRef.current.slice(-4), sample]
        const avg = wpmSamplesRef.current.reduce((a, b) => a + b, 0) / wpmSamplesRef.current.length
        setWpm(Math.round(avg))
      }
    }
    lastLocationTimeRef.current = now
    if (pageWordCount && pageWordCount > 0) lastPageWordsRef.current = pageWordCount

    // AI Word Wise — fire-and-forget per-page hint fetch. Background and
    // non-blocking; if it fails we just don't show hints. Skipped when
    // toggle is off, when there's no page text, or when the book metadata
    // hasn't loaded yet.
    if (prefs.wordWiseEnabled && pageText && pageText.length > 50 && book) {
      ;(async () => {
        try {
          const hints = await getWordWiseHints(
            pageText,
            book.title,
            book.author,
            currentChapter.title,
            { bookId: book.id, progress: percentage },
          )
          if (hints.length > 0) readerRef.current?.applyWordWiseHints(hints)
        } catch (e) {
          console.warn('[reader] word wise fetch failed:', e instanceof Error ? e.message : e)
        }
      })()
    }
  }

  function changePrefs(next: ReaderPrefs) {
    setPrefs(next)
    // Persist async; we don't block UI on the AsyncStorage write.
    savePrefs(userId, next).catch((e) => console.warn('[reader] save prefs failed:', e))
    // Push the resolved settings into the WebView so the change is visible
    // immediately — same code path as initial mount.
    readerRef.current?.applySettings(prefsToSettings(next))
  }

  function dismissPill() {
    setPillMode(null)
    setPillAnchor(null)
    setWordPayload(null)
    setPassagePayload(null)
  }

  // ── Pill action handlers ────────────────────────────────────────────────

  async function handleHighlight(color: HighlightColor) {
    // Resolve the active payload (word or passage) to a single highlight row.
    const cfi = (pillMode === 'word' ? wordPayload?.cfi : passagePayload?.cfi) ?? null
    const text = pillMode === 'word' ? wordPayload?.word : passagePayload?.text
    if (!cfi || !text || !book) {
      console.warn('[reader] highlight skipped — missing cfi/text/book')
      dismissPill()
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      dismissPill()
      return
    }
    const { error } = await supabase.from('highlights').insert({
      user_id: user.id,
      book_id: book.id,
      cfi,
      text,
      color,
      chapter: currentChapter.title || null,
    })
    if (error) {
      console.warn('[reader] save highlight failed:', error.message)
    } else {
      readerRef.current?.addHighlight(cfi, color)
    }
    // Word highlight also auto-saves vocabulary so the word ends up in
    // the Vocabulary screen even if the user didn't tap "Look up".
    if (pillMode === 'word' && wordPayload) {
      await supabase.from('vocabulary').insert({
        user_id: user.id,
        book_id: book.id,
        book_title: book.title,
        word: wordPayload.word,
        // `context` is NOT NULL in the legacy schema — keep it populated
        // alongside the new `context_sentence` column.
        context: wordPayload.surroundingText,
        context_sentence: wordPayload.surroundingText,
        // definition is also NOT NULL legacy — fill with a placeholder for
        // highlight-only saves; lookups overwrite this with the real AI text.
        definition: '(highlighted — open to look up definition)',
      })
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

  function handleDiscuss() {
    if (!passagePayload) {
      dismissPill()
      return
    }
    setChatSeed(
      `I selected this passage: "${passagePayload.text}" — what would you like to discuss about it?`,
    )
    setChatOpen(true)
    dismissPill()
  }

  function handleMenuAction(action: MenuAction) {
    setMenuOpen(false)
    switch (action) {
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
        // generated route types only refresh when Metro runs — on a cold
        // tsc the new file isn't known yet.
        if (book) router.push(`/vocabulary?bookId=${book.id}` as never)
        break
      case 'search':
        setSearchOpen(true)
        break
    }
  }

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
  const initialSettings: ReaderSettings = prefsToSettings(prefs)

  return (
    <View className="flex-1" style={{ backgroundColor: themeColors.background }}>
      <FoliateReaderWebView
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
          setCurrentChapter({ title: c.title, index: 0 })
          // Append to TOC sample for AI semantic-search if this chapter is new.
          setChapterList((prev) => (prev.includes(c.title) ? prev : [...prev, c.title]))
        }}
        onWordTapped={(word, surroundingText, cfi, rect: ReaderRect) => {
          console.log('[reader] word tap', { word, rect })
          // Tapping a different word while a pill is active dismisses the
          // old one and shows the new one — feels right; users wouldn't
          // expect the old pill to stick.
          setWordPayload({ word, surroundingText, cfi })
          setPassagePayload(null)
          setPillAnchor(rect)
          setPillMode('word')
        }}
        onPassageSelected={(text, cfi, rect: ReaderRect) => {
          console.log('[reader] passage select', { chars: text.length, rect })
          setPassagePayload({ text, cfi })
          setWordPayload(null)
          setPillAnchor(rect)
          setPillMode('passage')
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

      {/* Floating pill overlays everything; pointerEvents pass-through except
          on the pill itself so the rest of the canvas stays interactive. */}
      <FloatingPill
        visible={pillMode !== null}
        mode={pillMode ?? 'word'}
        anchor={pillAnchor}
        onDismiss={dismissPill}
        onLookup={handleLookup}
        onAnalyze={handleAnalyze}
        onDiscuss={handleDiscuss}
        onHighlight={handleHighlight}
      />

      {/* TOP CHROME BAR — Back · title · Aa · ☰ · bookmark. Phosphor
          regular weight throughout via IconContext at app root. */}
      {chrome ? (
        <SafeAreaView
          edges={['top']}
          pointerEvents="box-none"
          className="absolute top-0 left-0 right-0"
        >
          <View
            className="flex-row items-center justify-between px-3 py-2"
            style={{ backgroundColor: themeColors.background, opacity: 0.95 }}
          >
            <Pressable
              onPress={() => router.back()}
              className="px-2 py-2 flex-row items-center"
              accessibilityLabel="Back"
            >
              <CaretLeft color={colors.brandUi} size={20} />
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 16, color: colors.brandUi, marginLeft: 2 }}>
                Back
              </Text>
            </Pressable>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: Fonts.uiMedium, fontSize: 14,
                color: themeColors.text, flex: 1, textAlign: 'center',
              }}
            >
              {book.title}
            </Text>
            <View className="flex-row items-center">
              <Pressable onPress={() => setShowSettings(true)} className="px-2 py-2" accessibilityLabel="Typography">
                <TextAa color={colors.brandUi} size={22} />
              </Pressable>
              <Pressable onPress={() => setMenuOpen(true)} className="px-2 py-2" accessibilityLabel="Menu">
                <ListIcon color={colors.brandUi} size={22} />
              </Pressable>
              <Pressable
                onPress={() => setHighlightsOpen(true)}
                className="px-2 py-2"
                accessibilityLabel="Bookmarks"
              >
                <BookmarkSimple color={colors.brandUi} size={22} />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      ) : null}

      {/* BOTTOM CHROME BAR — chapter · % · live reading rate. Spec calls
          for "time remaining in chapter" but foliate doesn't surface
          chapter word totals; we show live WPM so the indicator is
          honest (improves once a few page-turn samples come in). */}
      {chrome ? (
        <SafeAreaView
          edges={['bottom']}
          pointerEvents="box-none"
          className="absolute bottom-0 left-0 right-0"
        >
          <View
            className="px-4 py-3 flex-row items-center"
            style={{ backgroundColor: themeColors.background, opacity: 0.95 }}
          >
            <Text
              numberOfLines={1}
              style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textSecondary, flex: 1 }}
            >
              {currentChapter.title || '—'}
            </Text>
            <Text
              style={{
                fontFamily: Fonts.uiMedium, fontSize: 13, color: themeColors.text,
                marginHorizontal: 12,
              }}
            >
              {Math.round(progress * 100)}%
            </Text>
            <Text
              style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, minWidth: 70, textAlign: 'right' }}
            >
              {wpm ? `${wpm} wpm` : '— wpm'}
            </Text>
          </View>
        </SafeAreaView>
      ) : null}

      <TypographySheet
        visible={showSettings}
        prefs={prefs}
        userId={userId}
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
        onAction={handleMenuAction}
        onClose={() => setMenuOpen(false)}
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
        bookId={book.id}
        onNavigate={(cfi) => readerRef.current?.goTo(cfi)}
        onClose={() => setHighlightsOpen(false)}
      />

      <SearchSheet
        visible={searchOpen}
        bookTitle={book.title}
        bookId={book.id}
        author={book.author}
        chapterList={chapterList}
        // Exact search not yet wired through to foliate — sheet shows a
        // "coming soon" message in that mode. AI Search routes by
        // chapter name; we treat that as a no-op for now since we don't
        // have a chapter-name → CFI map yet (a follow-up).
        onClose={() => setSearchOpen(false)}
      />
    </View>
  )
}
