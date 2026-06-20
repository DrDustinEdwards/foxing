import { Pressable, Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface UserBookRow {
  id: string
  status: 'reading' | 'paused' | 'want_to_read' | 'finished' | 'abandoned'
  progress_percentage: number
  is_favorite: boolean | null
}

export function PrimaryCta({
  userBook,
  onAddPress,
  onContinue,
  onReread,
}: {
  userBook: UserBookRow | null
  onAddPress: () => void
  onContinue: () => void
  onReread: () => void
}) {
  const colors = useColors()
  const label =
    userBook?.status === 'reading'
      ? `Continue Reading, ${Math.round((userBook.progress_percentage ?? 0) * 100)}%`
      : userBook?.status === 'finished'
        ? 'Read Again'
        : userBook?.status === 'want_to_read' || userBook?.status === 'abandoned'
          ? 'Start Reading'
          : 'Add to Library'
  const onPress =
    userBook?.status === 'reading'
      ? onContinue
      : userBook?.status === 'finished'
        ? onReread
        : userBook?.status === 'want_to_read' || userBook?.status === 'abandoned'
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
