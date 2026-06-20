import { View, Text, Pressable, Image, Linking } from 'react-native'
import { CalendarBlank, GoogleLogo } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface MeetingRow {
  id: string
  title: string
  description: string | null
  meeting_date: string
  end_date: string | null
  location_name: string | null
  location_url: string | null
  meeting_type: 'in_person' | 'virtual' | 'hybrid'
  is_cancelled: boolean
  book: { title: string; cover_url: string | null } | null
  rsvp_counts: { going: number; maybe: number; not_going: number }
  user_rsvp: 'going' | 'maybe' | 'not_going' | null
}

function formatMeetingTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ClubMeetingCard({
  m,
  userId,
  onRsvp,
}: {
  m: MeetingRow
  userId: string | null
  onRsvp: (meetingId: string, status: 'going' | 'maybe' | 'not_going') => void
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
            {formatMeetingTime(m.meeting_date)}
            {m.location_name ? ` · ${m.location_name}` : ''}
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
                {m.meeting_type.replace('_', ' ')}
              </Text>
            </View>
          </View>
          {m.location_url &&
          m.location_url.includes('meet.google.com') ? (
            <Pressable
              onPress={() => {
                if (m.location_url) void Linking.openURL(m.location_url)
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
          ) : m.location_url ? (
            <Pressable
              onPress={() => {
                if (m.location_url) void Linking.openURL(m.location_url)
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
      {m.book ? (
        <View
          className="flex-row items-center"
          style={{ gap: 8, marginTop: 10 }}
        >
          <View
            style={{
              width: 32,
              height: 48,
              borderRadius: 3,
              overflow: 'hidden',
              backgroundColor: colors.bgSunken,
            }}
          >
            {m.book.cover_url ? (
              <Image
                source={{ uri: m.book.cover_url }}
                style={{ width: '100%', height: '100%' }}
              />
            ) : null}
          </View>
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 12,
              color: colors.textSecondary,
            }}
            numberOfLines={2}
          >
            {m.book.title}
          </Text>
        </View>
      ) : null}

      {userId ? (
        <View
          className="flex-row"
          style={{ gap: 6, marginTop: 12 }}
        >
          {(['going', 'maybe', 'not_going'] as const).map((s) => {
            const active = m.user_rsvp === s
            const label =
              s === 'going'
                ? 'Going'
                : s === 'maybe'
                  ? 'Maybe'
                  : "Can't go"
            return (
              <Pressable
                key={s}
                onPress={() => void onRsvp(m.id, s)}
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
        {m.rsvp_counts.going} going · {m.rsvp_counts.maybe} maybe
      </Text>
    </View>
  )
}
