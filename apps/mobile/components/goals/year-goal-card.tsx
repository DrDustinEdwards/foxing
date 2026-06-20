import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { Section } from './section'

export function YearGoalCard({
  year,
  target,
  setTarget,
  save,
  saving,
  goalsRow,
  progress,
  projectedCompletion,
  colors,
}: {
  year: number
  target: string
  setTarget: (next: string) => void
  save: () => void
  saving: boolean
  goalsRow: { target: number } | null
  progress: number
  projectedCompletion: string | null
  colors: ReturnType<typeof useColors>
}) {
  return (
    <Section title={`${year} goal`}>
      <View
        className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        <Text
          style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textSecondary, marginBottom: 10 }}
        >
          I want to read
        </Text>
        <View className="flex-row items-center gap-2">
          <TextInput
            value={target}
            onChangeText={(t) => setTarget(t.replace(/[^0-9]/g, '').slice(0, 3))}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="12"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Books per year goal"
            style={{
              flex: 0,
              width: 90,
              fontFamily: Fonts.uiMedium,
              fontSize: 22,
              textAlign: 'center',
              color: colors.textPrimary,
              backgroundColor: colors.bgBase,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 10,
              paddingVertical: 8,
            }}
          />
          <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textSecondary, flex: 1 }}>
            books in {year}
          </Text>
          <Pressable
            onPress={save}
            disabled={saving || !target}
            accessibilityRole="button"
            accessibilityLabel="Save goal"
            accessibilityState={{ disabled: saving || !target }}
            className="px-4 py-2 rounded-full"
            style={{
              backgroundColor: target ? colors.brandUi : colors.bgDisabled,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color={colors.textOnBrand} size="small" />
            ) : (
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand, fontSize: 13 }}>
                Save
              </Text>
            )}
          </Pressable>
        </View>

        {goalsRow ? (
          <View style={{ marginTop: 16 }}>
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
                  width: `${Math.round(progress * 100)}%`,
                  backgroundColor: colors.brandUi,
                }}
              />
            </View>
            <View className="flex-row items-center justify-between" style={{ marginTop: 6 }}>
              <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: colors.textTertiary }}>
                {Math.round(progress * 100)}% complete
              </Text>
              {projectedCompletion ? (
                <Text
                  style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}
                >
                  Projected: {projectedCompletion}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </Section>
  )
}
