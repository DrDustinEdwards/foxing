import { useColors } from '@/constants/colors'
import { Pressable, Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'

export function StatTile({
  value,
  label,
  onPress,
}: {
  value: number
  label: string
  onPress?: () => void
}) {
  const colors = useColors()
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}
    >
      <Text
        style={{
          fontFamily: Fonts.displayBold,
          fontSize: 20,
          color: colors.textPrimary,
        }}
      >
        {formatStat(value)}
      </Text>
      <Text
        style={{
          fontFamily: Fonts.ui,
          fontSize: 11,
          color: colors.textTertiary,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function Divider() {
  const colors = useColors()
  return <View style={{ width: 1, backgroundColor: colors.borderSubtle, marginVertical: 4 }} />
}

export function pct(p: number): number {
  return Math.max(0, Math.min(100, Math.round((p ?? 0) * 100)))
}

function formatStat(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}
