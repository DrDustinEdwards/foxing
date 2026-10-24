import type * as W from '@foxing/types'
import { Pressable, Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export function ClubJoinCta({
  page,
  busy,
  onJoin,
  onLeave,
}: {
  page: W.ClubPage
  busy: boolean
  onJoin: () => void
  onLeave: () => void
}) {
  const colors = useColors()
  const membership = page.membership

  if (page.isMember) {
    const owner = membership?.role === 'owner'
    return (
      <Pressable
        onPress={onLeave}
        disabled={busy || owner}
        accessibilityRole="button"
        className="px-3 py-1 rounded-full border"
        style={{ borderColor: colors.borderInteractive }}
      >
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textPrimary }}>
          {busy ? '…' : owner ? 'Owner' : 'Leave'}
        </Text>
      </Pressable>
    )
  }

  // Joining a club that approves members, or one that is full, files a request or a
  // waitlist place; the server decides which.
  const waiting = membership?.status === 'waitlisted' || membership?.status === 'requested'
  const label = busy
    ? '…'
    : membership?.status === 'waitlisted'
      ? 'On the waitlist'
      : membership?.status === 'requested'
        ? 'Requested'
        : page.club.memberApproval
          ? 'Ask to join'
          : 'Join'
  return (
    <Pressable
      onPress={onJoin}
      disabled={busy || waiting || membership?.status === 'banned'}
      accessibilityRole="button"
      className="px-3 py-1 rounded-full"
      style={{
        backgroundColor: waiting ? colors.bgSelected : colors.brandUi,
        borderWidth: waiting ? 1 : 0,
        borderColor: waiting ? colors.borderBrand : 'transparent',
      }}
    >
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 12,
          color: waiting ? colors.brandText : colors.textOnBrand,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
