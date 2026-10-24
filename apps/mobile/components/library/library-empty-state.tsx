import { View, Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import type * as W from '@foxing/types'
import type { ShelfKey } from '@/components/library/library-types'

function statusMessage(status: W.ShelfStatus): string {
  switch (status) {
    case 'reading':
      return "You're not reading anything yet."
    case 'want':
      return 'Your reading list is empty.'
    case 'finished':
      return "You haven't finished a book yet."
    case 'paused':
      return 'Nothing paused.'
    default:
      return 'Nothing abandoned, nice.'
  }
}

export function LibraryEmptyState({ activeShelf }: { activeShelf: ShelfKey }) {
  const colors = useColors()
  const message =
    activeShelf.kind === 'status'
      ? statusMessage(activeShelf.status)
      : 'This shelf is empty.'
  return (
    <View className="items-center mt-12 px-8">
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: 14,
          color: colors.textTertiary,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </View>
  )
}
