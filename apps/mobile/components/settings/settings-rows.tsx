import { useColors } from '@/constants/colors'
import { Pressable, Switch, Text, TextInput, View } from 'react-native'
import { Fonts } from '@/constants/fonts'
import { CaretRight } from 'phosphor-react-native'

export function MetaHeader({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <Text
      style={{
        fontFamily: Fonts.displayBold,
        fontSize: 20,
        color: colors.textPrimary,
        marginTop: 24,
        marginBottom: 4,
      }}
    >
      {children}
    </Text>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View
      style={{ marginTop: 18 }}
      className="rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark overflow-hidden"
    >
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 4,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  )
}

export function ToggleRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string
  sub?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  const colors = useColors()
  return (
    <View
      className="flex-row items-center px-3 py-3 border-t"
      style={{ borderTopColor: colors.borderSubtle }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
          {label}
        </Text>
        {sub ? (
          <Text
            style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.bgDisabled, true: colors.toggleOn }}
      />
    </View>
  )
}

export function SegmentedRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}) {
  const colors = useColors()
  return (
    <View
      className="px-3 py-3 border-t"
      style={{ borderTopColor: colors.borderSubtle }}
    >
      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textTertiary, marginBottom: 6 }}>
        {label}
      </Text>
      <View className="flex-row" style={{ gap: 6 }}>
        {options.map((o) => {
          const active = o.value === value
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              className="px-3 py-1 rounded-full border"
              style={{
                backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                borderColor: active ? colors.borderBrand : colors.borderSubtle,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 12,
                  color: active ? colors.brandText : colors.textSecondary,
                }}
              >
                {o.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function TimeRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const colors = useColors()
  return (
    <View
      className="flex-row items-center px-3 py-3 border-t"
      style={{ borderTopColor: colors.borderSubtle }}
    >
      <Text style={{ flex: 1, fontFamily: Fonts.ui, fontSize: 13, color: colors.textSecondary }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="HH:MM"
        placeholderTextColor={colors.textTertiary}
        style={{
          fontFamily: Fonts.mono,
          fontSize: 14,
          color: colors.textPrimary,
          backgroundColor: colors.bgBase,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          minWidth: 80,
          textAlign: 'center',
        }}
        maxLength={5}
      />
    </View>
  )
}

export function LinkRow({
  label,
  onPress,
  Icon,
  destructive,
}: {
  label: string
  onPress: () => void
  Icon?: React.ComponentType<{ color: string; size: number }>
  destructive?: boolean
}) {
  const colors = useColors()
  const tint = destructive ? colors.error : colors.textPrimary
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-3 py-3 border-t"
      style={{ borderTopColor: colors.borderSubtle }}
    >
      {Icon ? (
        <View style={{ marginRight: 10 }}>
          <Icon color={tint} size={16} />
        </View>
      ) : null}
      <Text style={{ flex: 1, fontFamily: Fonts.uiMedium, fontSize: 14, color: tint }}>
        {label}
      </Text>
      <CaretRight color={colors.textTertiary} size={14} />
    </Pressable>
  )
}
