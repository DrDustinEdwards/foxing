import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export function ReadingLevelContent({
  difficultyBusy,
  difficulty,
  onRate,
}: {
  difficultyBusy: boolean
  difficulty: string | null
  onRate: () => void
}) {
  const colors = useColors()
  if (difficultyBusy) {
    return <ActivityIndicator color={colors.brandUi} />
  }
  if (difficulty) {
    return (
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: 13,
          color: colors.textPrimary,
          lineHeight: 19,
        }}
      >
        {difficulty}
      </Text>
    )
  }
  return (
    <Pressable onPress={onRate}>
      <Text
        style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.brandText }}
      >
        Rate this book's level
      </Text>
    </Pressable>
  )
}
