import { View, Text, Pressable } from 'react-native'
import { Trophy } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { type Challenge, CHALLENGE_TYPES } from '@/lib/challenges'
import { Section } from './section'

export function CommunityChallengesSection({
  communityChallenges,
  joinedIds,
  joinCommunityChallenge,
  colors,
}: {
  communityChallenges: Challenge[]
  joinedIds: Set<string>
  joinCommunityChallenge: (c: Challenge) => void
  colors: ReturnType<typeof useColors>
}) {
  return (
    <Section title="Community challenges">
      {communityChallenges.map((c) => {
        const unit = CHALLENGE_TYPES.find((t) => t.id === c.type)?.unit ?? ''
        const joined = joinedIds.has(c.id)
        return (
          <View
            key={c.id}
            className="p-4 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <View className="flex-row items-center" style={{ marginBottom: 6, gap: 8 }}>
              <Trophy color={colors.brandUi} size={16} weight="regular" />
              <Text
                style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary, flex: 1 }}
                numberOfLines={1}
              >
                {c.name}
              </Text>
              {joined ? (
                <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.success }}>
                  Joined
                </Text>
              ) : (
                <Pressable
                  onPress={() => joinCommunityChallenge(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`Join ${c.name}`}
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: colors.brandUi }}
                >
                  <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textOnBrand }}>
                    Join
                  </Text>
                </Pressable>
              )}
            </View>
            {c.description ? (
              <Text
                style={{
                  fontFamily: Fonts.body,
                  fontSize: 13,
                  color: colors.textSecondary,
                  marginBottom: 6,
                }}
              >
                {c.description}
              </Text>
            ) : null}
            <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.textTertiary }}>
              Target: {c.target} {unit}
              {c.deadline ? ` · by ${new Date(c.deadline).toLocaleDateString()}` : ''}
            </Text>
          </View>
        )
      })}
    </Section>
  )
}
