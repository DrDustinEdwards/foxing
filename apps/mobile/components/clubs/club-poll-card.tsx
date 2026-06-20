import { View, Text, Pressable, Image } from 'react-native'
import { ChartBar } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface PollOption {
  id: string
  label: string
  book_id: string | null
  position: number | null
  book: { title: string; cover_url: string | null } | null
  vote_count: number
}

interface PollRow {
  id: string
  title: string
  description: string | null
  poll_type: string
  closes_at: string | null
  is_closed: boolean
  options: PollOption[]
  user_vote: string | null
}

function formatMeetingTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ClubPollCard({
  p,
  onVote,
}: {
  p: PollRow
  onVote: (pollId: string, optionId: string) => void
}) {
  const colors = useColors()
  const total = p.options.reduce((sum, o) => sum + o.vote_count, 0)
  const hasVoted = p.user_vote !== null
  return (
    <View
      className="p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <View className="flex-row items-start" style={{ gap: 10 }}>
        <ChartBar
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
            {p.title}
          </Text>
          {p.description ? (
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 12,
                color: colors.textSecondary,
                marginTop: 4,
              }}
            >
              {p.description}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ marginTop: 10 }}>
        {p.options.map((o) => {
          const pct = total > 0 ? Math.round((o.vote_count / total) * 100) : 0
          const voted = p.user_vote === o.id
          return (
            <Pressable
              key={o.id}
              onPress={() => {
                if (!hasVoted) void onVote(p.id, o.id)
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: voted ? colors.brandUi : colors.borderSubtle,
                backgroundColor: voted ? colors.brandSubtle : colors.bgBase,
                marginBottom: 6,
              }}
            >
              <View
                className="flex-row items-center"
                style={{ gap: 8 }}
              >
                {o.book ? (
                  <View
                    style={{
                      width: 26,
                      height: 38,
                      borderRadius: 3,
                      overflow: 'hidden',
                      backgroundColor: colors.bgSunken,
                    }}
                  >
                    {o.book.cover_url ? (
                      <Image
                        source={{ uri: o.book.cover_url }}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : null}
                  </View>
                ) : null}
                <Text
                  style={{
                    flex: 1,
                    fontFamily: Fonts.uiMedium,
                    fontSize: 13,
                    color: voted ? colors.brandSubtleText : colors.textPrimary,
                  }}
                  numberOfLines={2}
                >
                  {o.book?.title ?? o.label}
                </Text>
                {hasVoted ? (
                  <Text
                    style={{
                      fontFamily: Fonts.mono,
                      fontSize: 11,
                      color: voted ? colors.brandSubtleText : colors.textTertiary,
                    }}
                  >
                    {pct}% · {o.vote_count}
                  </Text>
                ) : null}
              </View>
              {hasVoted ? (
                <View
                  style={{
                    marginTop: 6,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.bgSunken,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 4,
                      width: `${pct}%`,
                      backgroundColor: voted ? colors.brandUi : colors.brandSubtle,
                    }}
                  />
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </View>
      <Text
        style={{
          fontFamily: Fonts.mono,
          fontSize: 11,
          color: colors.textTertiary,
          marginTop: 6,
        }}
      >
        {total} vote{total === 1 ? '' : 's'}
        {p.closes_at ? ` · closes ${formatMeetingTime(p.closes_at)}` : ''}
      </Text>
    </View>
  )
}
