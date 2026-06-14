import { useEffect, useState } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { X as XIcon } from 'phosphor-react-native'
import { friendlyAiError, getWordAspect, lookupWord, type WordAspect } from '@/lib/claude'
import { supabase } from '@/lib/supabase'
import { reportWriteError } from '@/lib/db-write'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface WordLookupSheetProps {
  visible: boolean
  word: string
  sentence: string
  bookTitle: string
  bookId: string
  author: string
  era: string
  currentChapter?: string
  progress?: number
  onClose: () => void
}

const ASPECT_TABS: Array<{ id: WordAspect; label: string }> = [
  { id: 'pronunciation', label: 'Pronounce' },
  { id: 'etymology', label: 'Etymology' },
  { id: 'translation', label: 'Translate' },
  { id: 'synonyms', label: 'Synonyms' },
  { id: 'usage', label: 'Usage' },
]

// Hardcoded target languages for the Translate tab. Could be a user pref later.
const LANGUAGES = ['Spanish', 'French', 'German', 'Italian', 'Japanese', 'Mandarin', 'Korean'] as const

export function WordLookupSheet({
  visible,
  word,
  sentence,
  bookTitle,
  bookId,
  author,
  era,
  currentChapter,
  progress,
  onClose,
}: WordLookupSheetProps) {
  const colors = useColors()
  const [definition, setDefinition] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Per-aspect cache so flipping back to a tab is instant. Cleared on reopen.
  const [aspectCache, setAspectCache] = useState<Partial<Record<WordAspect, string>>>({})
  const [activeAspect, setActiveAspect] = useState<WordAspect | null>(null)
  const [aspectLoading, setAspectLoading] = useState(false)
  const [aspectError, setAspectError] = useState<string | null>(null)
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>('Spanish')

  useEffect(() => {
    if (!visible || !word) return
    console.log('[word-lookup] open', { word, bookTitle })
    setDefinition(null)
    setError(null)
    setAspectCache({})
    setActiveAspect(null)
    setAspectError(null)
    setLoading(true)
    ;(async () => {
      try {
        const result = await lookupWord(word, sentence, bookTitle, author, era, {
          bookId,
          currentChapter,
          progress,
        })
        console.log('[word-lookup] result', { word, chars: result.length })
        setDefinition(result)
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { error: vocabErr } = await supabase.from('vocabulary').insert({
            user_id: user.id,
            book_id: bookId,
            word,
            definition: result,
            context: sentence,
          })
          reportWriteError(vocabErr, { op: 'insert', table: 'vocabulary' })
        }
      } catch (e) {
        const message = friendlyAiError(e)
        console.warn('[word-lookup] error', message)
        setError(message)
      } finally {
        setLoading(false)
      }
    })()
  }, [visible, word, sentence, bookTitle, bookId, author, era, currentChapter, progress])

  async function pickAspect(aspect: WordAspect) {
    setActiveAspect(aspect)
    // Reuse the cache except for translation (where the language might change).
    if (aspect !== 'translation' && aspectCache[aspect]) {
      setAspectError(null)
      return
    }
    setAspectLoading(true)
    setAspectError(null)
    try {
      const text = await getWordAspect(aspect, {
        word,
        sentence,
        bookTitle,
        author,
        targetLanguage: aspect === 'translation' ? language : undefined,
        bookId,
        currentChapter,
        progress,
      })
      setAspectCache((m) => ({ ...m, [aspect]: text }))
    } catch (e) {
      setAspectError(friendlyAiError(e))
    } finally {
      setAspectLoading(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" onPress={onClose} accessibilityLabel="Close word lookup">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
          accessibilityLabel={`Word lookup for ${word}`}
          className="rounded-t-3xl px-6 pt-6 pb-10 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
          style={{ maxHeight: '85%' }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="font-display text-2xl text-brand-text-light dark:text-brand-text-dark">
              {word}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close word lookup"
            >
              <Text className="font-ui text-base text-brand-text-light dark:text-brand-text-dark">
                Close
              </Text>
            </Pressable>
          </View>

          {/* Definition */}
          <View style={{ marginBottom: 12 }}>
            {loading ? (
              <ActivityIndicator color={colors.brandUi} accessibilityLiveRegion="polite" accessibilityLabel="Loading definition" />
            ) : error ? (
              <View
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                className="flex-row items-start gap-2 rounded-lg px-3 py-2 bg-error-bg-light dark:bg-error-bg-dark"
              >
                <XIcon color={colors.error} size={16} />
                <Text className="font-ui flex-1 text-error-light dark:text-error-dark">{error}</Text>
              </View>
            ) : (
              <Text className="font-body text-base leading-7 text-text-primary-light dark:text-text-primary-dark">
                {definition}
              </Text>
            )}
          </View>

          {/* Aspect tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
          >
            {ASPECT_TABS.map((t) => {
              const active = activeAspect === t.id
              return (
                <Pressable
                  key={t.id}
                  onPress={() => pickAspect(t.id)}
                  className="px-3 py-1 rounded-full border"
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
                    {t.label}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

          {/* Language picker, only in Translate */}
          {activeAspect === 'translation' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, marginTop: 8 }}
            >
              {LANGUAGES.map((lng) => {
                const active = lng === language
                return (
                  <Pressable
                    key={lng}
                    onPress={() => {
                      setLanguage(lng)
                      // Force re-fetch with new language by clearing the cache.
                      setAspectCache((m) => ({ ...m, translation: undefined }))
                      // Refire, same aspect, new language.
                      setTimeout(() => pickAspect('translation'), 0)
                    }}
                    className="px-3 py-1 rounded-full border"
                    style={{
                      backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                      borderColor: active ? colors.borderBrand : colors.borderSubtle,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.ui,
                        fontSize: 11,
                        color: active ? colors.brandText : colors.textSecondary,
                      }}
                    >
                      {lng}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          ) : null}

          {/* Aspect result */}
          <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {activeAspect === null ? null : aspectLoading ? (
              <ActivityIndicator color={colors.brandUi} />
            ) : aspectError ? (
              <View
                className="flex-row items-start gap-2 rounded-lg px-3 py-2 bg-error-bg-light dark:bg-error-bg-dark"
              >
                <XIcon color={colors.error} size={16} />
                <Text className="font-ui flex-1 text-error-light dark:text-error-dark">
                  {aspectError}
                </Text>
              </View>
            ) : aspectCache[activeAspect] ? (
              <Text
                className="font-body text-base leading-7 text-text-primary-light dark:text-text-primary-dark"
              >
                {aspectCache[activeAspect]}
              </Text>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
