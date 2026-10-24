import type { CompanionAction } from '@foxing/client'
import { BookmarkSimple } from 'phosphor-react-native'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { CompanionSheet } from './companion-sheet'

const MODES: Array<{ action: CompanionAction; label: string }> = [
  { action: 'passage_analysis', label: 'Analyze' },
  { action: 'word_wise', label: 'Plain English' },
  { action: 'deep_dive', label: 'Go deeper' },
  { action: 'language_difficulty', label: 'Difficulty' },
]

// A selected passage: four ways to read it closer, and a save to the commonplace book.
export function PassageAnalysisSheet({
  visible,
  passage,
  bookId,
  currentChapter,
  onSavePassage,
  onClose,
}: {
  visible: boolean
  passage: string
  bookId: string
  currentChapter?: string
  onSavePassage: () => void
  onClose: () => void
}) {
  const colors = useColors()
  const [action, setAction] = useState<CompanionAction>('passage_analysis')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!visible) return
    setAction('passage_analysis')
    setSaved(false)
  }, [visible, passage])

  return (
    <CompanionSheet
      visible={visible}
      title={MODES.find((m) => m.action === action)?.label ?? 'Analyze'}
      request={{ action, bookId, selection: { text: passage.slice(0, 4000), chapter: currentChapter || null } }}
      onClose={onClose}
    >
      <Text
        numberOfLines={4}
        style={{ fontFamily: Fonts.body, fontStyle: 'italic', fontSize: 14, color: colors.textSecondary, marginBottom: 12 }}
      >
        “{passage}”
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
        {MODES.map((m) => {
          const active = m.action === action
          return (
            <Pressable
              key={m.action}
              onPress={() => setAction(m.action)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: active ? colors.brandUi : colors.bgSurface,
                borderWidth: 1,
                borderColor: active ? colors.brandUi : colors.borderSubtle,
              }}
            >
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: active ? colors.textOnBrand : colors.textPrimary }}>
                {m.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
      <View className="flex-row" style={{ marginBottom: 14 }}>
        <Pressable
          onPress={() => {
            if (saved) return
            onSavePassage()
            setSaved(true)
          }}
          accessibilityRole="button"
          className="flex-row items-center"
          style={{ gap: 6 }}
        >
          <BookmarkSimple color={colors.brandText} size={16} weight={saved ? 'fill' : 'regular'} />
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.brandText }}>
            {saved ? 'Saved to your commonplace book' : 'Save passage'}
          </Text>
        </Pressable>
      </View>
    </CompanionSheet>
  )
}
