import { useFollow } from '@foxing/client'
import { Pressable, Text } from 'react-native'
import { Plus, Check } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// Follow or unfollow one reader. The toggle patches every open profile and people
// list at once (useFollow), so the follower count moves with the button.
export function FollowButton({
  userId,
  isFollowing,
  size = 'md',
}: {
  userId: string
  isFollowing: boolean
  size?: 'sm' | 'md'
}) {
  const colors = useColors()
  const follow = useFollow()
  const labelSize = size === 'sm' ? 12 : 13
  const padX = size === 'sm' ? 12 : 16
  const padY = size === 'sm' ? 6 : 8
  const iconSize = size === 'sm' ? 12 : 14
  const fg = isFollowing ? colors.textPrimary : colors.textOnBrand

  return (
    <Pressable
      onPress={() => follow.fire({ userId, on: !isFollowing })}
      disabled={follow.pending}
      accessibilityRole="button"
      accessibilityLabel={isFollowing ? 'Unfollow' : 'Follow'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: padX,
        paddingVertical: padY,
        borderRadius: 999,
        backgroundColor: isFollowing ? colors.bgSurface : colors.brandUi,
        borderColor: isFollowing ? colors.borderInteractive : colors.brandUi,
        borderWidth: 1,
        opacity: follow.pending ? 0.7 : 1,
      }}
    >
      {isFollowing ? (
        <Check color={fg} size={iconSize} weight="bold" />
      ) : (
        <Plus color={fg} size={iconSize} weight="bold" />
      )}
      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: labelSize, color: fg }}>
        {isFollowing ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  )
}
