import type { FontFamilyKey, FontSizeStep, LineSpacingStep } from '@/lib/reader-settings'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { Pressable, Switch, Text, View } from 'react-native'

export function PreviewBox({
  fontFamily,
  fontSize,
  bold,
  lineSpacing,
}: {
  fontFamily: FontFamilyKey
  fontSize: FontSizeStep
  bold: boolean
  lineSpacing: LineSpacingStep
}) {
  const colors = useColors()
  const px = { xs: 14, s: 16, m: 18, l: 20, xl: 22, '2xl': 26, '3xl': 30 }[fontSize]
  const lh = { tight: 1.4, normal: 1.7, relaxed: 1.9, spacious: 2.2 }[lineSpacing]
  const ff =
    fontFamily === 'foxing' ? Fonts.body
    : fontFamily === 'modern' ? Fonts.ui
    : undefined // Georgia / OpenDyslexic, RN falls back to system
  return (
    <View
      className="mt-3 rounded-2xl p-4 border"
      style={{ backgroundColor: colors.bgReading, borderColor: colors.borderSubtle }}
    >
      <Text
        style={{
          fontFamily: ff,
          fontSize: px,
          lineHeight: px * lh,
          fontWeight: bold ? '600' : '400',
          color: colors.textPrimary,
        }}
      >
        The fox knew of foxing too: pages mottled with brown spots, the way time itself reads a beloved book.
      </Text>
    </View>
  )
}

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View className="mb-5">
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 12,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  )
}

export function StepRow<T extends string>({
  steps,
  value,
  labelFor,
  onSelect,
}: {
  steps: T[]
  value: T
  labelFor: (s: T) => string
  onSelect: (v: T) => void
}) {
  const colors = useColors()
  return (
    <View className="flex-row gap-1.5">
      {steps.map((s) => {
        const active = s === value
        return (
          <Pressable
            key={s}
            onPress={() => onSelect(s)}
            className="flex-1 rounded-xl py-2.5 items-center"
            style={{
              backgroundColor: active ? colors.brandUi : colors.bgSurface,
              borderWidth: 1,
              borderColor: active ? colors.brandUi : colors.borderSubtle,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: active ? colors.textOnBrand : colors.textPrimary,
              }}
            >
              {labelFor(s)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function SegmentedRow<T extends string>({
  steps,
  value,
  labelFor,
  onSelect,
}: {
  steps: T[]
  value: T
  labelFor: (s: T) => string
  onSelect: (v: T) => void
}) {
  const colors = useColors()
  return (
    <View
      className="flex-row rounded-xl p-1 bg-bg-sunken-light dark:bg-bg-sunken-dark"
    >
      {steps.map((s) => {
        const active = s === value
        return (
          <Pressable
            key={s}
            onPress={() => onSelect(s)}
            className="flex-1 items-center py-2 rounded-lg"
            style={{ backgroundColor: active ? colors.bgSurface : 'transparent' }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: active ? colors.textPrimary : colors.textTertiary,
              }}
            >
              {labelFor(s)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function ToggleRow({
  value,
  onValueChange,
  label,
}: {
  value: boolean
  onValueChange: (v: boolean) => void
  label: string
}) {
  const colors = useColors()
  return (
    <View
      className="flex-row items-center justify-between rounded-xl px-4 py-3 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <Text style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textPrimary, flex: 1, marginRight: 12 }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.toggleOn, false: colors.borderDefault }}
        thumbColor={colors.bgSurface}
      />
    </View>
  )
}
