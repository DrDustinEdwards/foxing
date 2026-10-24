import type * as W from '@foxing/types'
import { Pressable, Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export function PrimaryCta({
  userBook,
  onAddPress,
  onContinue,
  onReread,
}: {
  userBook: W.MyBookState | null
  onAddPress: () => void
  onContinue: () => void
  onReread: () => void
}) {
  const colors = useColors()
  const label =
    userBook?.status === 'reading'
      ? `Continue Reading, ${Math.round(userBook.progressPct)}%`
      : userBook?.status === 'finished'
        ? 'Read Again'
        : userBook?.status === 'want' || userBook?.status === 'abandoned' || userBook?.status === 'paused'
          ? 'Start Reading'
          : 'Add to Library'
  const onPress =
    userBook?.status === 'reading'
      ? onContinue
      : userBook?.status === 'finished'
        ? onReread
        : userBook?.status === 'want' || userBook?.status === 'abandoned' || userBook?.status === 'paused'
          ? onContinue
          : onAddPress
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="py-4 rounded-full"
      style={{ backgroundColor: colors.brandUi, marginTop: 12, alignItems: 'center' }}
    >
      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textOnBrand }}>
        {label}
      </Text>
    </Pressable>
  )
}
