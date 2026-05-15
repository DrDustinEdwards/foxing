import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { type Locator } from 'react-native-readium'
import { supabase } from '@/lib/supabase'
import { ensureEpubLocallyCached } from '@/lib/storage'
import { Colors, useColors } from '@/constants/colors'
import {
  ReaderReadium,
  type ReaderRef,
  type ReaderSettings,
} from '@/components/reader/reader-readium'
import { SettingsSheet, type ThemeKey } from '@/components/reader/settings-sheet'
import { WordLookupSheet } from '@/components/reader/word-lookup-sheet'
import { PassageAnalysisSheet } from '@/components/reader/passage-analysis-sheet'
import { ChapterSummaryModal } from '@/components/reader/chapter-summary-modal'
import { CompanionChat } from '@/components/reader/companion-chat'

interface BookRow {
  id: string
  title: string
  author: string
  epub_url: string
}

// Reading canvas modes are independent of the app's UI theme — they're set by
// the reader. The canvas always uses the bg-reading family of tokens.
const READING_THEMES: Record<ThemeKey, { background: string; text: string }> = {
  light: { background: Colors.light.bgReading, text: Colors.light.textPrimary },
  sepia: { background: Colors.light.bgReadingSepia, text: Colors.light.textOnSepia },
  dark: { background: Colors.dark.bgReading, text: Colors.dark.textPrimary },
}

const CHROME_AUTO_HIDE_MS = 4000

// Stored progress is the JSON-serialized Locator. Old @epubjs-react-native
// CFI strings are not compatible — try to parse, fall back to undefined so
// Readium starts at the beginning. (Acceptable one-time migration cost; the
// reader will re-save in Locator format the moment the user moves a page.)
function parseStoredLocator(stored: string | null | undefined): Locator | undefined {
  if (!stored) return undefined
  try {
    const parsed = JSON.parse(stored)
    if (parsed && typeof parsed === 'object' && typeof parsed.href === 'string') {
      return parsed as Locator
    }
  } catch {
    // Not JSON — assume it's a legacy epubcfi string we can't restore.
  }
  return undefined
}

export default function Reader() {
  const colors = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const readerRef = useRef<ReaderRef>(null)
  const sessionIdRef = useRef<string | null>(null)
  const positionRef = useRef<{ locator: Locator | null; progression: number }>({
    locator: null,
    progression: 0,
  })
  const lastSaveRef = useRef<number>(Date.now())
  const chromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [book, setBook] = useState<BookRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [localEpubPath, setLocalEpubPath] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [initialLocator, setInitialLocator] = useState<Locator | undefined>(undefined)
  const [readerState, setReaderState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [readerError, setReaderError] = useState<string | null>(null)

  const [fontSize, setFontSize] = useState(18)
  const [lineHeight, setLineHeight] = useState(1.7)
  const [themeKey, setThemeKey] = useState<ThemeKey>('dark')
  const [showSettings, setShowSettings] = useState(false)

  // Chrome starts hidden; tap toggles; auto-hides after 4s of no touch.
  const [chrome, setChrome] = useState(false)

  const [currentChapter, setCurrentChapter] = useState({ title: '', index: 0 })
  const [progress, setProgress] = useState(0)

  const [wordSheet, setWordSheet] = useState<{ word: string; sentence: string } | null>(null)
  const [passageSheet, setPassageSheet] = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    let mounted = true
    ;(async () => {
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('id, title, author, epub_url')
        .eq('id', id)
        .single()
      console.log('[reader] book query result', { bookData, error: bookError?.message })
      if (!mounted || !bookData) {
        setLoading(false)
        return
      }
      console.log('[reader] book.epub_url (remote):', bookData.epub_url)
      setBook(bookData as BookRow)

      // Readium reads file.url as a local path; mirror the remote EPUB into
      // the device cache before passing it to ReadiumView. Cached after
      // first download so subsequent opens are instant.
      const cached = await ensureEpubLocallyCached(bookData.epub_url)
      if (!mounted) return
      if (!cached) {
        setDownloadError("We couldn't download the book file. Please try again.")
      } else {
        console.log('[reader] local epub path:', cached)
        setLocalEpubPath(cached)
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: ub } = await supabase
          .from('user_books')
          .select('progress_cfi, progress_percentage')
          .eq('user_id', user.id)
          .eq('book_id', bookData.id)
          .maybeSingle()
        const restored = parseStoredLocator(ub?.progress_cfi)
        if (restored) setInitialLocator(restored)
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

  // Auto-hide chrome 4s after it appears. Cancel/reset whenever it changes.
  useEffect(() => {
    if (chromeTimerRef.current) {
      clearTimeout(chromeTimerRef.current)
      chromeTimerRef.current = null
    }
    if (chrome) {
      chromeTimerRef.current = setTimeout(() => {
        setChrome(false)
      }, CHROME_AUTO_HIDE_MS)
    }
    return () => {
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current)
    }
  }, [chrome])

  const toggleChrome = useCallback(() => {
    setChrome((v) => !v)
  }, [])

  async function saveProgress() {
    if (!book || !positionRef.current.locator) return
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
          // Reuse the existing progress_cfi text column to store the
          // serialized Readium Locator. parseStoredLocator on next open.
          progress_cfi: JSON.stringify(positionRef.current.locator),
          progress_percentage: positionRef.current.progression,
        },
        { onConflict: 'user_id,book_id' }
      )
  }

  async function endSession() {
    if (!sessionIdRef.current) return
    await supabase
      .from('reading_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionIdRef.current)
  }

  function onLocation(locator: Locator, progression: number) {
    positionRef.current = { locator, progression }
    setProgress(progression)
  }

  function applySettings(next: Partial<{ fontSize: number; lineHeight: number; theme: ThemeKey }>) {
    const fs = next.fontSize ?? fontSize
    const lh = next.lineHeight ?? lineHeight
    const tk = next.theme ?? themeKey
    if (next.fontSize !== undefined) setFontSize(fs)
    if (next.lineHeight !== undefined) setLineHeight(lh)
    if (next.theme !== undefined) setThemeKey(tk)
    readerRef.current?.applySettings({
      fontSize: fs,
      lineHeight: lh,
      theme: READING_THEMES[tk],
    })
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
        <Pressable onPress={() => router.back()}>
          <Text className="font-ui text-brand-text-light dark:text-brand-text-dark">← Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const themeColors = READING_THEMES[themeKey]
  const initialSettings: ReaderSettings = {
    fontSize,
    lineHeight,
    theme: themeColors,
  }

  return (
    <View className="flex-1" style={{ backgroundColor: themeColors.background }}>
      {localEpubPath ? (
      <ReaderReadium
        ref={readerRef}
        epubUrl={localEpubPath}
        initialLocator={initialLocator}
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
        onChapterChange={(c) => setCurrentChapter({ title: c.title, index: 0 })}
        onWordTap={(word, sentence) => {
          console.log('[reader] word tap', { word })
          setWordSheet({ word, sentence })
        }}
        onPassageSelect={(passage) => {
          console.log('[reader] passage select', { chars: passage.length })
          setPassageSheet(passage)
        }}
      />
      ) : null}

      {!localEpubPath && !downloadError ? (
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
            Downloading book…
          </Text>
        </View>
      ) : null}

      {downloadError ? (
        <View
          className="absolute inset-0 items-center justify-center px-6"
          style={{ backgroundColor: themeColors.background }}
        >
          <View className="flex-row items-center gap-2 mb-3">
            <Text className="font-ui text-error-light dark:text-error-dark text-lg">✕</Text>
            <Text
              className="font-ui-medium text-lg text-center"
              style={{ color: themeColors.text }}
            >
              {downloadError}
            </Text>
          </View>
          <Pressable onPress={() => router.back()}>
            <Text className="font-ui text-base" style={{ color: colors.brandUi }}>
              ← Back to library
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Tap-to-toggle-chrome overlay. pointerEvents="box-only" makes the
          overlay catch taps without children participating; we mount it as
          a sibling to ReadiumView so native selection on the Readium view
          underneath is unaffected (Readium's native gesture recognizers
          live below the JS responder layer). */}
      <Pressable
        onPress={toggleChrome}
        pointerEvents="box-only"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
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
            <Text className="font-ui text-error-light dark:text-error-dark text-lg">✕</Text>
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
          <Text
            className="font-mono text-xs mb-6 text-center"
            style={{ color: themeColors.text, opacity: 0.5 }}
          >
            {book.epub_url}
          </Text>
          <Pressable onPress={() => router.back()}>
            <Text className="font-ui text-base" style={{ color: colors.brandUi }}>
              ← Back to library
            </Text>
          </Pressable>
        </View>
      ) : null}

      {chrome ? (
        <SafeAreaView
          edges={['top']}
          pointerEvents="box-none"
          className="absolute top-0 left-0 right-0"
        >
          <View
            className="flex-row items-center justify-between px-4 py-2"
            style={{ backgroundColor: themeColors.background, opacity: 0.95 }}
          >
            <Pressable onPress={() => router.back()}>
              <Text className="font-ui text-base" style={{ color: colors.brandUi }}>
                Close
              </Text>
            </Pressable>
            <View className="flex-1 mx-3">
              <Text
                numberOfLines={1}
                className="font-ui-medium text-center"
                style={{ color: themeColors.text }}
              >
                {book.title}
              </Text>
              {currentChapter.title ? (
                <Text
                  numberOfLines={1}
                  className="font-ui text-center text-xs"
                  style={{ color: colors.brandText }}
                >
                  {currentChapter.title}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => setSummaryOpen(true)}>
              <Text className="font-ui text-base" style={{ color: colors.brandUi }}>
                Recap
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}

      {chrome ? (
        <SafeAreaView
          edges={['bottom']}
          pointerEvents="box-none"
          className="absolute bottom-0 left-0 right-0"
        >
          <View
            className="px-4 py-3"
            style={{ backgroundColor: themeColors.background, opacity: 0.95 }}
          >
            <View className="flex-row items-center mb-3">
              <Pressable onPress={() => readerRef.current?.prev()} className="px-3 py-2">
                <Text className="font-ui text-lg" style={{ color: colors.brandUi }}>‹</Text>
              </Pressable>
              <View className="flex-1 mx-3">
                <View
                  className="h-1 rounded-full"
                  style={{ backgroundColor: colors.borderSubtle }}
                >
                  <View
                    className="h-1 rounded-full"
                    style={{
                      backgroundColor: colors.brandUi,
                      width: `${Math.round(progress * 100)}%`,
                    }}
                  />
                </View>
                <Text
                  className="font-mono text-xs mt-1 text-center"
                  style={{ color: colors.brandText }}
                >
                  {Math.round(progress * 100)}%
                </Text>
              </View>
              <Pressable onPress={() => readerRef.current?.next()} className="px-3 py-2">
                <Text className="font-ui text-lg" style={{ color: colors.brandUi }}>›</Text>
              </Pressable>
            </View>
            <View className="flex-row justify-around">
              <Pressable onPress={() => setShowSettings(true)} className="py-2 px-4">
                <Text className="font-display" style={{ color: colors.brandUi }}>Aa</Text>
              </Pressable>
              <Pressable onPress={() => setChatOpen(true)} className="py-2 px-4">
                <Text className="font-ui" style={{ color: colors.brandUi }}>Chat</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      ) : null}

      <SettingsSheet
        visible={showSettings}
        fontSize={fontSize}
        lineHeight={lineHeight}
        theme={themeKey}
        onChangeFontSize={(v) => applySettings({ fontSize: v })}
        onChangeLineHeight={(v) => applySettings({ lineHeight: v })}
        onChangeTheme={(t) => applySettings({ theme: t })}
        onClose={() => setShowSettings(false)}
      />

      {wordSheet ? (
        <WordLookupSheet
          visible
          word={wordSheet.word}
          sentence={wordSheet.sentence}
          bookTitle={book.title}
          bookId={book.id}
          author={book.author}
          era=""
          onClose={() => setWordSheet(null)}
        />
      ) : null}

      {passageSheet ? (
        <PassageAnalysisSheet
          visible
          passage={passageSheet}
          bookTitle={book.title}
          author={book.author}
          era=""
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
        onClose={() => setSummaryOpen(false)}
      />

      <CompanionChat
        visible={chatOpen}
        bookTitle={book.title}
        author={book.author}
        currentChapter={currentChapter.title || 'the current chapter'}
        onClose={() => setChatOpen(false)}
      />
    </View>
  )
}
