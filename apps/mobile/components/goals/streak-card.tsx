import type * as W from '@foxing/types'
import { View, Text } from 'react-native'
import { Flame } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { Section } from './section'

export function StreakCard({
  streak,
  colors,
}: {
  streak: W.Streak | null
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
              {streak?.currentStreak ?? 0}
            </Text>
            <Text
              style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: -4 }}
            >
              day{(streak?.currentStreak ?? 0) === 1 ? '' : 's'} in a row
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
              {streak?.longestStreak ?? 0}
            </Text>
            <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>
              longest
            </Text>
          </View>
        </View>
      </View>
    </Section>
  )
}
