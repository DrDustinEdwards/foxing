import { View, Text, Pressable } from 'react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export type SleepTimerOption =
  | { kind: 'minutes'; minutes: number }
  | { kind: 'end_of_chapter' }
  | { kind: 'cancel' }

interface Props {
  visible: boolean
  active: SleepTimerOption | null
  onPick: (opt: SleepTimerOption) => void
  onClose: () => void
}

const MINUTE_OPTIONS = [5, 10, 15, 30, 45, 60]

export function SleepTimerSheet({ visible, active, onPick, onClose }: Props) {
  const colors = useColors()
  const isActiveMinutes = (m: number) =>
    active?.kind === 'minutes' && active.minutes === m
  const isActiveEoc = active?.kind === 'end_of_chapter'

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
            fontSize: 12,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            paddingHorizontal: 20,
            marginBottom: 8,
          }}
        >
          Sleep timer
        </Text>
      }
    >
          <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {MINUTE_OPTIONS.map((m) => {
                const isActive = isActiveMinutes(m)
                return (
                  <Pressable
                    key={m}
                    onPress={() => onPick({ kind: 'minutes', minutes: m })}
                    accessibilityRole="button"
                    accessibilityLabel={`Sleep timer ${m} minutes`}
                    className="px-4 py-3 rounded-full border"
                    style={{
                      backgroundColor: isActive ? colors.bgSelected : colors.bgSurface,
                      borderColor: isActive ? colors.borderBrand : colors.borderSubtle,
                      minWidth: 70,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 14,
                        color: isActive ? colors.brandText : colors.textPrimary,
                      }}
                    >
                      {m} min
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
          <Pressable
            onPress={() => onPick({ kind: 'end_of_chapter' })}
            accessibilityRole="button"
            accessibilityLabel="End of chapter sleep timer"
            className="flex-row items-center px-5 py-4 border-t mt-3"
            style={{ borderTopColor: colors.borderSubtle }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 15,
                color: isActiveEoc ? colors.brandText : colors.textPrimary,
                flex: 1,
              }}
            >
              End of chapter
            </Text>
            {isActiveEoc ? (
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}>
                Active
              </Text>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => onPick({ kind: 'cancel' })}
            accessibilityRole="button"
            accessibilityLabel="Cancel sleep timer"
            className="flex-row items-center px-5 py-4 border-t"
            style={{ borderTopColor: colors.borderSubtle }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 15,
                color: active ? colors.error : colors.textTertiary,
                flex: 1,
              }}
            >
              {active ? 'Cancel timer' : 'No timer set'}
            </Text>
          </Pressable>
    </SheetScaffold>
  )
}
