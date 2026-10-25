import { View, Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// The labeled text field every form sheet uses.
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 12,
          color: colors.textTertiary,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  )
}

export function inputStyle(colors: ReturnType<typeof useColors>) {
  return {
    fontFamily: Fonts.ui,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  } as const
}
