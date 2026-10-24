import type * as W from '@foxing/types'
import { View, Text, Pressable, Linking } from 'react-native'
import { CalendarBlank, GoogleLogo } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

function formatMeetingTime(at: number): string {
  return new Date(at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ClubMeetingCard({
  m,
  canRsvp,
  onRsvp,
}: {
  m: W.ClubMeetingItem
  canRsvp: boolean
  onRsvp: (meetingId: string, status: W.RsvpStatus) => void
}) {
  const colors = useColors()
  return (
    <View
      className="p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <View className="flex-row items-start" style={{ gap: 10 }}>
        <CalendarBlank
          color={colors.textSecondary}
          size={18}
          weight="regular"
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 14,
              color: colors.textPrimary,
            }}
          >
            {m.title}
          </Text>
          <Text
            style={{
              fontFamily: Fonts.mono,
              fontSize: 11,
              color: colors.textTertiary,
              marginTop: 2,
            }}
          >
            {formatMeetingTime(m.meetingDate)}
            {m.locationName ? ` · ${m.locationName}` : ''}
          </Text>
          <View
            className="flex-row flex-wrap"
            style={{ gap: 6, marginTop: 6 }}
          >
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: colors.bgSunken,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.mono,
                  fontSize: 11,
                  color: colors.textTertiary,
                  textTransform: 'capitalize',
                }}
              >
                {m.meetingType.replace('_', ' ')}
              </Text>
            </View>
          </View>
          {m.locationUrl &&
          m.locationUrl.includes('meet.google.com') ? (
            <Pressable
              onPress={() => {
                if (m.locationUrl) void Linking.openURL(m.locationUrl)
              }}
              className="flex-row items-center"
              style={{ gap: 6, marginTop: 8 }}
            >
              <GoogleLogo color={colors.brandText} size={14} />
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 12,
                  color: colors.brandText,
                }}
              >
                Join on Google Meet
              </Text>
            </Pressable>
          ) : m.locationUrl ? (
            <Pressable
              onPress={() => {
                if (m.locationUrl) void Linking.openURL(m.locationUrl)
              }}
              style={{ marginTop: 8 }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 12,
                  color: colors.brandText,
                }}
              >
                Join link
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {canRsvp ? (
        <View
          className="flex-row"
          style={{ gap: 6, marginTop: 12 }}
        >
          {(['going', 'maybe', 'not_going'] as const).map((s) => {
            const active = m.myRsvp === s
            const label =
              s === 'going'
                ? 'Going'
                : s === 'maybe'
                  ? 'Maybe'
                  : "Can't go"
            return (
              <Pressable
                key={s}
                onPress={() => onRsvp(m.id, s)}
                style={{
                  flex: 1,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? colors.brandUi : colors.borderSubtle,
                  backgroundColor: active
                    ? colors.brandSubtle
                    : colors.bgBase,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 12,
                    color: active ? colors.brandSubtleText : colors.textSecondary,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}
      <Text
        style={{
          fontFamily: Fonts.mono,
          fontSize: 11,
          color: colors.textTertiary,
          marginTop: 6,
        }}
      >
        {m.rsvps.going} going · {m.rsvps.maybe} maybe
      </Text>
    </View>
  )
}
