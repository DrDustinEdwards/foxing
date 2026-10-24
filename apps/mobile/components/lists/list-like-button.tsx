import { useReaction } from '@foxing/client'
import { Pressable, Text } from 'react-native'
import { BookmarkSimple } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface Props {
  listId: string
  liked: boolean
  count: number
  /** Signed out readers see the count but cannot like. */
  canLike: boolean
}

/** Like a reading list; the list page's count patches at once and rolls back on failure. */
export function ListLikeButton({ listId, liked, count, canLike }: Props) {
  const colors = useColors()
  const reaction = useReaction()
  const color = liked ? colors.brandUi : colors.textTertiary
  return (
    <Pressable
      onPress={() => reaction.fire({ targetType: 'reading_list', targetId: listId, on: !liked })}
      hitSlop={10}
      disabled={!canLike}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked ? 'Unlike this list' : 'Like this list'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 4,
      }}
    >
      <BookmarkSimple color={color} size={16} weight={liked ? 'fill' : 'regular'} />
      {count > 0 ? <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color }}>{count}</Text> : null}
    </Pressable>
  )
}
