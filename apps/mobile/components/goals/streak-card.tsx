import { View, Text, Pressable } from 'react-native'
import { Flame, Snowflake } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { Section } from './section'

interface StreakRow {
  current_streak: number
  longest_streak: number
  streak_freeze_credits: number
  last_read_date: string | null
}

export function StreakCard({
  streak,
  streakAtRisk,
  useFreeze,
  usingFreeze,
  freezeError,
  last30,
  colors,
}: {
  streak: StreakRow | null
  streakAtRisk: boolean
  useFreeze: () => void
  usingFreeze: boolean
  freezeError: string | null
  last30: Array<{ date: string; minutes: number }>
  colors: ReturnType<typeof useColors>
}) {
  return (
    <Section title="Streak">
      <View
        className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        <View className="flex-row items-center">
          <Flame color={colors.brandUi} size={42} weight="fill" />
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text
              style={{ fontFamily: Fonts.displayBold, fontSize: 36, color: colors.textPrimary }}
            >
              {streak?.current_streak ?? 0}
            </Text>
            <Text
              style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: -4 }}
            >
              day{(streak?.current_streak ?? 0) === 1 ? '' : 's'} in a row
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
              {streak?.longest_streak ?? 0}
            </Text>
            <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>
              longest
            </Text>
          </View>
        </View>

        <View className="flex-row items-center" style={{ marginTop: 12 }}>
          <Snowflake color={colors.info} size={14} />
          <Text
            style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textSecondary, marginLeft: 6 }}
          >
            {streak?.streak_freeze_credits ?? 0} freeze credit
            {(streak?.streak_freeze_credits ?? 0) === 1 ? '' : 's'} available
          </Text>
        </View>

        {streakAtRisk ? (
          <View style={{ marginTop: 12 }}>
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textSecondary,
              }}
            >
              Your streak is at risk. Use a freeze to protect it for today.
            </Text>
            <Pressable
              onPress={useFreeze}
              disabled={usingFreeze}
              accessibilityRole="button"
              accessibilityLabel="Use a freeze"
              style={{
                alignSelf: 'flex-start',
                marginTop: 8,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.brandUi,
                opacity: usingFreeze ? 0.7 : 1,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  color: colors.textOnBrand,
                  fontSize: 13,
                }}
              >
                Use a freeze
              </Text>
            </Pressable>
            {freezeError ? (
              <Text
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 11,
                  color: colors.error ?? colors.textTertiary,
                  marginTop: 6,
                }}
              >
                {freezeError}
              </Text>
            ) : null}
          </View>
        ) : (streak?.streak_freeze_credits ?? 0) === 0 ? (
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 11,
              color: colors.textTertiary,
              marginTop: 6,
            }}
          >
            Earn freeze credits by maintaining a 7-day streak.
          </Text>
        ) : null}

        {/* Heat map, 30 dots, last 30 days */}
        <View className="flex-row flex-wrap" style={{ marginTop: 14, gap: 4 }}>
          {last30.map((d) => {
            const intensity = Math.min(1, d.minutes / 30) // 30 min → max
            const filled = d.minutes > 0
            const bg = filled
              ? colors.brandUi
              : colors.bgSunken
            return (
              <View
                key={d.date}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  backgroundColor: bg,
                  opacity: filled ? 0.35 + intensity * 0.65 : 1,
                }}
              />
            )
          })}
        </View>
      </View>
    </Section>
  )
}
