import { useColors } from '@/constants/colors'
import { Pressable, Text } from 'react-native'
import { Fonts } from '@/constants/fonts'
import type * as W from '@foxing/types'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { STATUS_SHELVES } from '@/components/library/library-types'

export function BulkActionButton({
  Icon,
  label,
  onPress,
  disabled,
  destructive,
}: {
  Icon: React.ComponentType<{ color: string; size: number; weight?: 'regular' | 'fill' }>
  label: string
  onPress: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  const colors = useColors()
  const tint = disabled ? colors.textTertiary : destructive ? colors.error : colors.brandText
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      className="items-center"
      style={{ paddingHorizontal: 10, paddingVertical: 6, opacity: disabled ? 0.4 : 1, flex: 1 }}
    >
      <Icon color={tint} size={20} />
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: tint,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function BulkShelfPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean
  onClose: () => void
  onPick: (status: W.ShelfStatus) => void | Promise<void>
}) {
  const colors = useColors()
  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      scroll={false}
      header={
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            paddingHorizontal: 20,
            marginBottom: 8,
          }}
        >
          Move to shelf
        </Text>
      }
    >
          {STATUS_SHELVES.map((s, i) => (
            <Pressable
              key={s.status}
              onPress={() => onPick(s.status)}
              accessibilityRole="button"
              accessibilityLabel={`Move to ${s.label}`}
              className="px-5 py-4"
              style={{
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.borderSubtle,
              }}
            >
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}>
                {s.label}
              </Text>
            </Pressable>
          ))}
    </SheetScaffold>
  )
}
