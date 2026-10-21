import { useColors } from '@/constants/colors'
import { Pressable, Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'
import type { UserBookStatus } from '@/lib/library'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { STATUS_SHELVES } from '@/components/library/library-types'
import { useEffect, useState } from 'react'
import { Star } from 'phosphor-react-native'

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
  onPick: (status: UserBookStatus) => void | Promise<void>
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

export function BulkRatePicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean
  onClose: () => void
  onPick: (rating: number) => void | Promise<void>
}) {
  const colors = useColors()
  const [draft, setDraft] = useState(0)
  useEffect(() => {
    if (visible) setDraft(0)
  }, [visible])
  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      scroll={false}
      contentContainerStyle={{ paddingHorizontal: 20 }}
      header={
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 10,
            paddingHorizontal: 20,
          }}
        >
          Rate selected books
        </Text>
      }
      footer={
        <View className="flex-row justify-end" style={{ gap: 10 }}>
          <Pressable onPress={onClose} className="px-4 py-2">
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textSecondary }}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onPick(draft)}
            disabled={draft === 0}
            className="px-4 py-2 rounded-full"
            style={{
              backgroundColor: draft > 0 ? colors.brandUi : colors.bgDisabled,
            }}
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
              Apply
            </Text>
          </Pressable>
        </View>
      }
    >
          <View className="flex-row justify-center" style={{ gap: 6, marginBottom: 16 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = n <= draft
              return (
                <Pressable
                  key={n}
                  onPress={() => setDraft(n === draft ? 0 : n)}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${n} ${n === 1 ? 'star' : 'stars'}`}
                  hitSlop={6}
                >
                  <Star
                    color={filled ? colors.brandSecondary : colors.textTertiary}
                    weight={filled ? 'fill' : 'regular'}
                    size={32}
                  />
                </Pressable>
              )
            })}
          </View>
    </SheetScaffold>
  )
}
