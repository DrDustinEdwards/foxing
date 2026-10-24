import type * as W from '@foxing/types'
import { View, Text, Pressable } from 'react-native'
import { ChartBar } from 'phosphor-react-native'
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

export function ClubPollCard({
  p,
  onVote,
}: {
  p: W.ClubPollItem
  onVote: (pollId: string, optionId: string) => void
}) {
  const colors = useColors()
  // Tallies count first preferences, so a ranked poll shows where it stands now.
  const total = p.voteCount
  const myChoice = p.myVote?.[0] ?? null
  const hasVoted = myChoice !== null || p.isClosed
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
          const votes = p.tallies[o.id] ?? 0
          const pct = total > 0 ? Math.round((votes / total) * 100) : 0
          const voted = myChoice === o.id
          return (
            <Pressable
              key={o.id}
              onPress={() => {
                if (!p.isClosed) onVote(p.id, o.id)
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: voted, disabled: p.isClosed }}
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
                <Text
                  style={{
                    flex: 1,
                    fontFamily: Fonts.uiMedium,
                    fontSize: 13,
                    color: voted ? colors.brandSubtleText : colors.textPrimary,
                  }}
                  numberOfLines={2}
                >
                  {o.label}
                </Text>
                {hasVoted ? (
                  <Text
                    style={{
                      fontFamily: Fonts.mono,
                      fontSize: 11,
                      color: voted ? colors.brandSubtleText : colors.textTertiary,
                    }}
                  >
                    {pct}% · {votes}
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
        {p.isClosed ? ' · closed' : p.closesAt ? ` · closes ${formatMeetingTime(p.closesAt)}` : ''}
      </Text>
    </View>
  )
}
