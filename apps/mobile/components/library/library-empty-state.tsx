import { View, Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import type { UserBookStatus } from '@/lib/library'
import type { ShelfKey } from '@/app/(tabs)/library'

function statusMessage(status: UserBookStatus): string {
  switch (status) {
    case 'reading':
      return "You're not reading anything yet."
    case 'want_to_read':
      return 'Your reading list is empty.'
    case 'finished':
      return "You haven't finished a book yet."
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
