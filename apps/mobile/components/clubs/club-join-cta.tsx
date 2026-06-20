import { Pressable, Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { type ClubRole, type ClubWithBook } from '@/lib/clubs'

export function ClubJoinCta({
  club,
  role,
  viewerId,
  busyJoin,
  waitlistPosition,
  onJoin,
  onLeave,
}: {
  club: ClubWithBook
  role: ClubRole | null
  viewerId: string | null
  busyJoin: boolean
  waitlistPosition: number | null
  onJoin: () => void
  onLeave: () => void
}) {
  const colors = useColors()

  if (role) {
    return (
      <Pressable
        onPress={onLeave}
        disabled={busyJoin}
        className="px-3 py-1 rounded-full border"
        style={{ borderColor: colors.borderInteractive }}
      >
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textPrimary }}>
          {busyJoin ? '…' : role === 'admin' ? 'Owner' : 'Leave'}
        </Text>
      </Pressable>
    )
  }

  const isFull =
    !!club &&
    typeof club.max_members === 'number' &&
    club.max_members > 0 &&
    club.member_count >= club.max_members
  const onWaitlist = waitlistPosition !== null
  const label = busyJoin
    ? '…'
    : onWaitlist
      ? `Waitlist #${waitlistPosition}`
      : isFull
        ? 'Join Waitlist'
        : 'Join'
  return (
    <Pressable
      onPress={onJoin}
      disabled={busyJoin || !viewerId || onWaitlist}
      className="px-3 py-1 rounded-full"
      style={{
        backgroundColor: onWaitlist ? colors.bgSelected : colors.brandUi,
        borderWidth: onWaitlist ? 1 : 0,
        borderColor: onWaitlist ? colors.borderBrand : 'transparent',
      }}
    >
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 12,
          color: onWaitlist ? colors.brandText : colors.textOnBrand,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
