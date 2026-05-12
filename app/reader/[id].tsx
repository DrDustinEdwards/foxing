import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import {
  ReaderWebView,
  type ReaderRef,
  type ReaderSettings,
} from '@/components/reader/reader-webview'
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

const THEMES: Record<ThemeKey, { background: string; text: string }> = {
  light: { background: Colors.background.light, text: Colors.text.light },
  sepia: { background: Colors.background.sepia, text: Colors.text.sepia },
  dark: { background: Colors.background.dark, text: Colors.text.dark },
}

export default function Reader() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const readerRef = useRef<ReaderRef>(null)
  const sessionIdRef = useRef<string | null>(null)
  const positionRef = useRef<{ cfi: string | null; percentage: number }>({
    cfi: null,
    percentage: 0,
  })
  const lastSaveRef = useRef<number>(Date.now())

  const [book, setBook] = useState<BookRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialCfi, setInitialCfi] = useState<string | null>(null)
  const [chrome, setChrome] = useState(true)

  const [fontSize, setFontSize] = useState(18)
  const [lineHeight, setLineHeight] = useState(1.7)
  const [themeKey, setThemeKey] = useState<ThemeKey>('dark')
  const [showSettings, setShowSettings] = useState(false)

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
      const { data: bookData } = await supabase
        .from('books')
        .select('id, title, author, epub_url')
        .eq('id', id)
        .single()
      if (!mounted || !bookData) {
        setLoading(false)
        return
      }
      setBook(bookData as BookRow)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
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

  function onLocation(cfi: string, percentage: number) {
    positionRef.current = { cfi, percentage }
    setProgress(percentage)
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
      theme: THEMES[tk],
    })
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: '#1A1208' }}>
        <ActivityIndicator color="#8B6914" />
      </SafeAreaView>
    )
  }

  if (!book) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8" style={{ backgroundColor: '#1A1208' }}>
        <Text className="mb-4" style={{ color: '#E8D5B0' }}>
          We couldn't load that book.
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: '#C4973A' }}>← Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const themeColors = THEMES[themeKey]
  const initialSettings: ReaderSettings = {
    fontSize,
    lineHeight,
    theme: themeColors,
  }

  return (
    <View className="flex-1" style={{ backgroundColor: themeColors.background }}>
      <Pressable className="flex-1" onPress={() => setChrome((v) => !v)}>
        <ReaderWebView
          ref={readerRef}
          epubUrl={book.epub_url}
          initialCfi={initialCfi ?? undefined}
          initialSettings={initialSettings}
          onLocationChange={onLocation}
          onChapterChange={(c) => setCurrentChapter({ title: c.title, index: 0 })}
          onWordTap={(word, sentence) => setWordSheet({ word, sentence })}
          onPassageSelect={(passage) => setPassageSheet(passage)}
        />
      </Pressable>

      {chrome ? (
        <SafeAreaView
          edges={['top']}
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          <View
            className="flex-row items-center justify-between px-4 py-2"
            style={{ backgroundColor: themeColors.background, opacity: 0.95 }}
          >
            <Pressable onPress={() => router.back()}>
              <Text style={{ color: Colors.primary, fontSize: 16 }}>Close</Text>
            </Pressable>
            <View className="flex-1 mx-3">
              <Text numberOfLines={1} className="font-semibold text-center" style={{ color: themeColors.text }}>
                {book.title}
              </Text>
              {currentChapter.title ? (
                <Text numberOfLines={1} className="text-center text-xs" style={{ color: Colors.primary }}>
                  {currentChapter.title}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => setSummaryOpen(true)}>
              <Text style={{ color: Colors.primary, fontSize: 16 }}>Recap</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}

      {chrome ? (
        <SafeAreaView
          edges={['bottom']}
          pointerEvents="box-none"
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
        >
          <View
            className="px-4 py-3"
            style={{ backgroundColor: themeColors.background, opacity: 0.95 }}
          >
            <View className="flex-row items-center mb-3">
              <Pressable onPress={() => readerRef.current?.prev()} className="px-3 py-2">
                <Text style={{ color: Colors.primary, fontSize: 18 }}>‹</Text>
              </Pressable>
              <View className="flex-1 mx-3">
                <View className="h-1 rounded-full" style={{ backgroundColor: Colors.border.dark }}>
                  <View
                    className="h-1 rounded-full"
                    style={{
                      backgroundColor: Colors.primary,
                      width: `${Math.round(progress * 100)}%`,
                    }}
                  />
                </View>
                <Text className="text-xs mt-1 text-center" style={{ color: Colors.primary }}>
                  {Math.round(progress * 100)}%
                </Text>
              </View>
              <Pressable onPress={() => readerRef.current?.next()} className="px-3 py-2">
                <Text style={{ color: Colors.primary, fontSize: 18 }}>›</Text>
              </Pressable>
            </View>
            <View className="flex-row justify-around">
              <Pressable onPress={() => setShowSettings(true)} className="py-2 px-4">
                <Text style={{ color: Colors.primary }}>Aa</Text>
              </Pressable>
              <Pressable onPress={() => setChatOpen(true)} className="py-2 px-4">
                <Text style={{ color: Colors.primary }}>Chat</Text>
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
