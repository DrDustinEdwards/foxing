import { useColors } from '@/constants/colors'
import { Section } from '@/components/goals/section'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Fonts } from '@/constants/fonts'

interface PeriodGoalCardProps {
  title: string
  unitNoun: string
  target: string
  onChange: (next: string) => void
  row: { target: number } | null
  finished: number
  saving: boolean
  onSave: () => void
  onRemove: () => void
  max: number
  colors: ReturnType<typeof useColors>
}

export function PeriodGoalCard({
  title,
  unitNoun,
  target,
  onChange,
  row,
  finished,
  saving,
  onSave,
  onRemove,
  max,
  colors,
}: PeriodGoalCardProps) {
  const ratio = row ? Math.max(0, Math.min(1, finished / row.target)) : 0
  return (
    <Section title={title}>
      <View
        className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        <View className="flex-row items-center gap-2">
          <TextInput
            value={target}
            onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
            placeholder={String(Math.min(max, 4))}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={`${title} target`}
            style={{
              width: 72,
              fontFamily: Fonts.uiMedium,
              fontSize: 20,
              textAlign: 'center',
              color: colors.textPrimary,
              backgroundColor: colors.bgBase,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 10,
              paddingVertical: 8,
            }}
          />
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textSecondary,
              flex: 1,
            }}
          >
            books {unitNoun}
          </Text>
          <Pressable
            onPress={onSave}
            disabled={saving || !target}
            accessibilityRole="button"
            accessibilityLabel="Save"
            className="px-4 py-2 rounded-full"
            style={{
              backgroundColor: target ? colors.brandUi : colors.bgDisabled,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                color: colors.textOnBrand,
                fontSize: 13,
              }}
            >
              Save
            </Text>
          </Pressable>
        </View>
        {row ? (
          <View style={{ marginTop: 14 }}>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.bgSunken,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: 6,
                  width: `${Math.round(ratio * 100)}%`,
                  backgroundColor: colors.brandUi,
                }}
              />
            </View>
            <View
              className="flex-row items-center justify-between"
              style={{ marginTop: 6 }}
            >
              <Text
                style={{
                  fontFamily: Fonts.mono,
                  fontSize: 12,
                  color: colors.textTertiary,
                }}
              >
                {finished} of {row.target} books
              </Text>
              <Pressable onPress={onRemove}>
                <Text
                  style={{
                    fontFamily: Fonts.ui,
                    fontSize: 11,
                    color: colors.textTertiary,
                  }}
                >
                  Remove goal
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Section>
  )
}
