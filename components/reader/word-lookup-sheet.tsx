import { useEffect, useState } from 'react'
import { View, Text, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native'
import { lookupWord } from '@/lib/claude'
import { supabase } from '@/lib/supabase'

interface WordLookupSheetProps {
  visible: boolean
  word: string
  sentence: string
  bookTitle: string
  bookId: string
  author: string
  era: string
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
  onClose,
}: WordLookupSheetProps) {
  const [definition, setDefinition] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible || !word) return
    setDefinition(null)
    setError(null)
    setLoading(true)
    ;(async () => {
      try {
        const result = await lookupWord(word, sentence, bookTitle, author, era)
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
        setError(e instanceof Error ? e.message : 'Lookup failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [visible, word, sentence, bookTitle, bookId, author, era])

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl px-6 pt-6 pb-10"
          style={{ backgroundColor: '#2A1F0F', maxHeight: '75%' }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-serif" style={{ color: '#C4973A' }}>
              {word}
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-base" style={{ color: '#8B6914' }}>
                Close
              </Text>
            </Pressable>
          </View>
          <ScrollView>
            {loading ? (
              <ActivityIndicator color="#8B6914" />
            ) : error ? (
              <Text style={{ color: '#D32F2F' }}>{error}</Text>
            ) : (
              <Text className="text-base leading-7" style={{ color: '#E8D5B0' }}>
                {definition}
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
