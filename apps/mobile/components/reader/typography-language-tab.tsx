import { useVocabulary } from '@foxing/client'
import type { ReaderPrefs } from '@/lib/reader-settings'
import { useColors } from '@/constants/colors'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Share, Text, View } from 'react-native'
import { Section } from './typography-controls'
import { Fonts } from '@/constants/fonts'

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Japanese',
  'Mandarin',
] as const

// The translation language the reader's Translate action uses, and an Anki export of
// the words looked up in this book.
export function LanguageTab({
  prefs,
  set,
  bookId,
}: {
  prefs: ReaderPrefs
  set: <K extends keyof ReaderPrefs>(k: K, v: ReaderPrefs[K]) => void
  bookId?: string
}) {
  const colors = useColors()
  const vocabulary = useVocabulary()
  const [toast, setToast] = useState<string | null>(null)

  const exportAnki = useCallback(async () => {
    const items = (vocabulary.data ?? []).filter((w) => w.bookId === bookId)
    if (items.length === 0) {
      setToast('No vocabulary saved for this book yet.')
      setTimeout(() => setToast(null), 2000)
      return
    }
    const csv = [
      'Front,Back',
      ...items.map((r) => {
        const front = escapeCsv(r.word)
        const back = escapeCsv(`${r.definition}${r.contextSentence ? `\n\n${r.contextSentence}` : ''}`)
        return `${front},${back}`
      }),
    ].join('\n')
    await Share.share({ message: csv }).catch(() => {})
  }, [bookId, vocabulary.data])

  return (
    <View>
      <Section label="Target language">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {LANGUAGES.map((lng) => {
              const active = lng === prefs.targetLanguage
              return (
                <Pressable
                  key={lng}
                  onPress={() => set('targetLanguage', lng)}
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

      <Section label="Vocabulary export">
        <Pressable
          onPress={exportAnki}
          disabled={!bookId || vocabulary.isPending}
          className="flex-row items-center justify-center py-3 rounded-full border"
          style={{ borderColor: colors.borderInteractive, opacity: !bookId || vocabulary.isPending ? 0.7 : 1 }}
        >
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
            Export to Anki (CSV)
          </Text>
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
