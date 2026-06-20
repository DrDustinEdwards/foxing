import { View, Text, Pressable } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export function AutoScrollSpeed({
  autoScrollWpm,
  onSelect,
}: {
  autoScrollWpm: number
  onSelect: (wpm: number) => void
}) {
  const colors = useColors()
  return (
    <View style={{ marginTop: 10 }}>
      <View className="flex-row items-center justify-between" style={{ marginBottom: 6 }}>
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary }}
        >
          Speed
        </Text>
        <Text
          style={{
            fontFamily: Fonts.mono,
            fontSize: 12,
            color: colors.brandText,
          }}
        >
          {autoScrollWpm} wpm
        </Text>
      </View>
      <View className="flex-row" style={{ gap: 6 }}>
        {[100, 160, 220, 280, 340, 400].map((wpm) => {
          const active = autoScrollWpm === wpm
          return (
            <Pressable
              key={wpm}
              onPress={() => onSelect(wpm)}
              className="flex-1 items-center py-2 rounded-lg"
              style={{
                backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                borderWidth: 1,
                borderColor: active ? colors.borderBrand : colors.borderSubtle,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 11,
                  color: active ? colors.brandText : colors.textSecondary,
                }}
              >
                {wpm}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
