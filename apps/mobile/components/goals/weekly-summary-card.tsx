import { View, Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { Section } from './section'

export function WeeklySummaryCard({
  last7,
  max7,
  colors,
}: {
  last7: Array<{ date: string; minutes: number }>
  max7: number
  colors: ReturnType<typeof useColors>
}) {
  return (
    <Section title="This week">
      <View
        className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        <View
          className="flex-row justify-between"
          style={{ height: 100, marginBottom: 6 }}
        >
          {last7.map((d) => {
            const ratio = d.minutes / max7
            return (
              <View key={d.date} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ flex: 1, justifyContent: 'flex-end', width: '70%' }}>
                  <View
                    style={{
                      height: `${Math.max(2, Math.round(ratio * 100))}%`,
                      backgroundColor: d.minutes > 0 ? colors.brandUi : colors.bgSunken,
                      borderRadius: 4,
                    }}
                  />
                </View>
              </View>
            )
          })}
        </View>
        <View className="flex-row justify-between" style={{ marginTop: 2 }}>
          {last7.map((d) => {
            const dayLetter = new Date(d.date + 'T00:00:00Z').toLocaleDateString(undefined, {
              weekday: 'narrow',
            })
            return (
              <Text
                key={d.date}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontFamily: Fonts.ui,
                  fontSize: 10,
                  color: colors.textTertiary,
                }}
              >
                {dayLetter}
              </Text>
            )
          })}
        </View>
      </View>
    </Section>
  )
}
