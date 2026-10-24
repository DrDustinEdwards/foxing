import type { CompanionRequest } from '@foxing/client'
import { useEffect, useState } from 'react'
import { Pressable, Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { CompanionSheet } from './companion-sheet'

// A tapped word: what it means here, then what is notable about it. Each definition
// is saved to the reader's vocabulary.
export function WordLookupSheet({
  visible,
  word,
  sentence,
  bookId,
  currentChapter,
  onSaveWord,
  onClose,
}: {
  visible: boolean
  word: string
  sentence: string
  bookId: string
  currentChapter?: string
  onSaveWord: (w: { word: string; definition: string; contextSentence: string }) => void
  onClose: () => void
}) {
  const colors = useColors()
  const [more, setMore] = useState(false)
  useEffect(() => {
    if (visible) setMore(false)
  }, [visible, word])

  const request: CompanionRequest = {
    action: more ? 'word_aspect' : 'word_lookup',
    bookId,
    selection: { text: word, chapter: currentChapter || null },
  }

  return (
    <CompanionSheet
      visible={visible}
      title={more ? 'About the word' : 'Look up'}
      eyebrow={word}
      request={request}
      onClose={onClose}
      onAnswer={(definition) => {
        if (!more) onSaveWord({ word, definition, contextSentence: sentence })
      }}
      footer={() =>
        more ? null : (
          <Pressable onPress={() => setMore(true)} accessibilityRole="button" style={{ marginTop: 16 }}>
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.brandText }}>
              More about this word
            </Text>
          </Pressable>
        )
      }
    />
  )
}
