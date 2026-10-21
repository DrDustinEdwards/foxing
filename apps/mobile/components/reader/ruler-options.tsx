import { View, Text, Pressable } from 'react-native'
import { useColors, Colors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { type RulerColor, type RulerStyle } from '@/lib/reader-settings'
import { SegmentedRow } from './typography-controls'

export function RulerOptions({
  rulerColor,
  rulerStyle,
  onSelectColor,
  onSelectStyle,
}: {
  rulerColor: RulerColor
  rulerStyle: RulerStyle
  onSelectColor: (c: RulerColor) => void
  onSelectStyle: (s: RulerStyle) => void
}) {
  const colors = useColors()
  return (
    <View className="mt-3">
      <Text
        style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginBottom: 8 }}
      >
        Color
      </Text>
      <View className="flex-row gap-2 mb-3">
        {(['amber', 'cream', 'charcoal'] as RulerColor[]).map((c) => {
          const active = c === rulerColor
          const bg = c === 'amber' ? colors.hlAmberT
            : c === 'cream' ? Colors.light.bgBase
            : Colors.dark.bgBase
          return (
            <Pressable
              key={c}
              onPress={() => onSelectColor(c)}
              style={{
                width: 32, height: 32, borderRadius: 16, backgroundColor: bg,
                borderWidth: 2, borderColor: active ? colors.brandUi : colors.borderSubtle,
              }}
            />
          )
        })}
      </View>
      <SegmentedRow
        steps={['highlight', 'block-rest'] as RulerStyle[]}
        value={rulerStyle}
        labelFor={(s) => (s === 'highlight' ? 'Highlight line' : 'Block rest')}
        onSelect={onSelectStyle}
      />
    </View>
  )
}
