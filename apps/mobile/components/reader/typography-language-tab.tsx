import type { ReaderPrefs } from '@/lib/reader-settings'
import { useColors } from '@/constants/colors'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getLanguageDifficulty } from '@/lib/claude'
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native'
import { Section, ToggleRow } from './typography-controls'
import { Fonts } from '@/constants/fonts'
import { ReadingLevelContent } from './reading-level-content'

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Japanese',
  'Mandarin',
] as const

export function LanguageTab({
  prefs,
  set,
  userId,
  bookId,
  bookTitle,
  bookAuthor,
}: {
  prefs: ReaderPrefs
  set: <K extends keyof ReaderPrefs>(k: K, v: ReaderPrefs[K]) => void
  userId: string | null
  bookId?: string
  bookTitle?: string
  bookAuthor?: string
}) {
  const colors = useColors()
  const [difficulty, setDifficulty] = useState<string | null>(null)
  const [difficultyBusy, setDifficultyBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Lazy-load the CEFR difficulty rating for the current book. Cached in
  // book_ai_cache so subsequent opens are instant.
  const loadDifficulty = useCallback(async () => {
    if (!bookId || !bookTitle || !bookAuthor) return
    if (difficulty) return
    setDifficultyBusy(true)
    try {
      const { data: cached } = await supabase
        .from('book_ai_cache')
        .select('content')
        .eq('cache_key', bookId)
        .eq('action', 'language_difficulty')
        .maybeSingle()
      const cachedText = (cached as { content?: string } | null)?.content
      if (cachedText) {
        setDifficulty(cachedText)
        return
      }
      const text = await getLanguageDifficulty({ bookTitle, author: bookAuthor, bookId })
      setDifficulty(text)
      await supabase
        .from('book_ai_cache')
        .upsert(
          { cache_key: bookId, action: 'language_difficulty', content: text },
          { onConflict: 'cache_key,action' },
        )
    } catch (e) {
      console.warn('[language] difficulty fetch failed:', e instanceof Error ? e.message : e)
    } finally {
      setDifficultyBusy(false)
    }
  }, [bookAuthor, bookId, bookTitle, difficulty])

  useEffect(() => {
    if (bookId && prefs.bilingualMode) loadDifficulty()
  }, [bookId, prefs.bilingualMode, loadDifficulty])

  // Write target language to profiles.language_preference for cross-device
  // recall in addition to the local ReaderPrefs flip.
  const setLanguage = useCallback(
    async (lang: string) => {
      set('targetLanguage', lang)
      if (userId) {
        await supabase
          .from('profiles')
          .update({ language_preference: lang })
          .eq('id', userId)
      }
    },
    [set, userId],
  )

  // Anki CSV export, pulls vocabulary rows for the current book, builds a
  // Front/Back two-column CSV, shares via native Share as text.
  const exportAnki = useCallback(async () => {
    if (!userId || !bookId) {
      setToast('Open a book first.')
      setTimeout(() => setToast(null), 1800)
      return
    }
    setExportBusy(true)
    try {
      const { data: rows } = await supabase
        .from('vocabulary')
        .select('word, definition, context')
        .eq('user_id', userId)
        .eq('book_id', bookId)
      const items = ((rows ?? []) as Array<{
        word: string | null
        definition: string | null
        context: string | null
      }>)
      if (items.length === 0) {
        setToast('No vocabulary saved for this book yet.')
        setTimeout(() => setToast(null), 2000)
        return
      }
      const csv = [
        'Front,Back',
        ...items.map((r) => {
          const front = escapeCsv(r.word ?? '')
          const back = escapeCsv(`${r.definition ?? ''}${r.context ? `\n\n${r.context}` : ''}`)
          return `${front},${back}`
        }),
      ].join('\n')
      await Share.share({ message: csv })
    } catch (e) {
      console.warn('[language] anki export failed:', e instanceof Error ? e.message : e)
    } finally {
      setExportBusy(false)
    }
  }, [bookId, userId])

  return (
    <View>
      <Section label="Bilingual mode">
        <ToggleRow
          value={prefs.bilingualMode}
          onValueChange={(v) => set('bilingualMode', v)}
          label="Show translations under each paragraph"
        />
      </Section>

      <Section label="Target language">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {LANGUAGES.map((lng) => {
              const active = lng === prefs.targetLanguage
              return (
                <Pressable
                  key={lng}
                  onPress={() => setLanguage(lng)}
                  className="px-3 py-2 rounded-full border"
                  style={{
                    backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                    borderColor: active ? colors.borderBrand : colors.borderSubtle,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 12,
                      color: active ? colors.brandText : colors.textSecondary,
                    }}
                  >
                    {lng}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      </Section>

      <Section label="Grammar mode">
        <ToggleRow
          value={prefs.grammarMode}
          onValueChange={(v) => set('grammarMode', v)}
          label="Tap any word for grammar of its sentence"
        />
      </Section>

      {bookId ? (
        <Section label="Reading level">
          <View
            className="p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <ReadingLevelContent
              difficultyBusy={difficultyBusy}
              difficulty={difficulty}
              onRate={loadDifficulty}
            />
          </View>
        </Section>
      ) : null}

      <Section label="Vocabulary export">
        <Pressable
          onPress={exportAnki}
          disabled={exportBusy}
          className="flex-row items-center justify-center py-3 rounded-full border"
          style={{ borderColor: colors.borderInteractive, opacity: exportBusy ? 0.7 : 1 }}
        >
          {exportBusy ? (
            <ActivityIndicator color={colors.brandUi} size="small" />
          ) : (
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
              Export to Anki (CSV)
            </Text>
          )}
        </Pressable>
      </Section>

      {toast ? (
        <View
          style={{ marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: colors.bgSelected }}
        >
          <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textPrimary }}>
            {toast}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function escapeCsv(s: string): string {
  const text = (s ?? '').replace(/"/g, '""')
  return /[",\n]/.test(text) ? `"${text}"` : text
}
