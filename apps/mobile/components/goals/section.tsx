import { View, Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 10,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  )
}
