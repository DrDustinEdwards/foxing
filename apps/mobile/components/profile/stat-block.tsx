import { useColors } from '@/constants/colors'
import { Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'

export function StatBlock({ heading, children }: { heading: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 6,
        }}
      >
        {heading}
      </Text>
      <View className="flex-row flex-wrap" style={{ marginHorizontal: -8 }}>
        {children}
      </View>
    </View>
  )
}

export function StatLine({ value, label }: { value: string; label: string }) {
  const colors = useColors()
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, minWidth: '33%' }}>
      <Text style={{ fontFamily: Fonts.displayBold, fontSize: 18, color: colors.brandText }}>
        {value}
      </Text>
      <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>
        {label}
      </Text>
    </View>
  )
}

export function deriveStreaks(timestamps: string[]): { current: number; longest: number } {
  const days = Array.from(
    new Set(
      timestamps.filter(Boolean).map((ts) => new Date(ts).toISOString().slice(0, 10))
    )
  ).sort()
  if (days.length === 0) return { current: 0, longest: 0 }

  // Longest run of consecutive UTC days.
  let longest = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + 'T00:00:00Z').getTime()
    const cur = new Date(days[i] + 'T00:00:00Z').getTime()
    if (cur - prev === 86_400_000) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 1
    }
  }

  // Current streak walks back from today.
  const daySet = new Set(days)
  let current = 0
  const cursor = new Date()
  while (true) {
    const key = cursor.toISOString().slice(0, 10)
    if (daySet.has(key)) {
      current += 1
      cursor.setUTCDate(cursor.getUTCDate() - 1)
    } else {
      break
    }
  }
  return { current, longest }
}
