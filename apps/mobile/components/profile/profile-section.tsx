import { View, Text, Pressable } from 'react-native'
import { CaretRight } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
  children: React.ReactNode
}) {
  const colors = useColors()
  return (
    <View style={{ marginBottom: 24 }}>
      <View className="flex-row items-center justify-between mb-3">
        <Text style={{ fontFamily: Fonts.display, fontSize: 16, color: colors.textPrimary }}>
          {title}
        </Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} className="flex-row items-center gap-1">
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}>
              {actionLabel}
            </Text>
            <CaretRight color={colors.brandText} size={12} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  )
}
