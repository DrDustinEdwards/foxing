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
