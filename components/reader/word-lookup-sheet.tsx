import { useEffect, useState } from 'react'
import { View, Text, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native'
import { lookupWord } from '@/lib/claude'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'

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

  useEffect(() => {
    if (!visible || !word) return
    console.log('[word-lookup] open', { word, bookTitle })
    setDefinition(null)
    setError(null)
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
          await supabase.from('vocabulary').insert({
            user_id: user.id,
            book_id: bookId,
            word,
            definition: result,
            context: sentence,
          })
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Lookup failed'
        console.warn('[word-lookup] error', message)
        setError(message)
      } finally {
        setLoading(false)
      }
    })()
  }, [visible, word, sentence, bookTitle, bookId, author, era, currentChapter, progress])

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl px-6 pt-6 pb-10 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
          style={{ maxHeight: '75%' }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="font-display text-2xl text-brand-text-light dark:text-brand-text-dark">
              {word}
            </Text>
            <Pressable onPress={onClose}>
              <Text className="font-ui text-base text-brand-text-light dark:text-brand-text-dark">
                Close
              </Text>
            </Pressable>
          </View>
          {/* flex:1 + the parent's maxHeight gives the ScrollView a bounded
              height; without flex:1 the ScrollView would size to its content
              and the inner Text would overflow the sheet without scrolling. */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {loading ? (
              <ActivityIndicator color={colors.brandUi} />
            ) : error ? (
              <View className="flex-row items-start gap-2 rounded-lg px-3 py-2 bg-error-bg-light dark:bg-error-bg-dark">
                <Text className="font-ui text-error-light dark:text-error-dark">✕</Text>
                <Text className="font-ui flex-1 text-error-light dark:text-error-dark">
                  {error}
                </Text>
              </View>
            ) : (
              <Text className="font-body text-base leading-7 text-text-primary-light dark:text-text-primary-dark">
                {definition}
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
