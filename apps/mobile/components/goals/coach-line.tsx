import { View, Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export function CoachLine({
  label,
  value,
  colors,
}: {
  label: string
  value: string
  colors: ReturnType<typeof useColors>
}) {
  return (
    <View className="flex-row items-baseline" style={{ marginBottom: 4 }}>
      <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, flex: 1 }}>
        {label}
      </Text>
      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
        {value}
      </Text>
    </View>
  )
}
