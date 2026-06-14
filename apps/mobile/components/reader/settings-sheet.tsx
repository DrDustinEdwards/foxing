import { View, Text, Pressable } from 'react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { Colors } from '@/constants/colors'

export type ThemeKey = 'light' | 'sepia' | 'dark'

interface SettingsSheetProps {
  visible: boolean
  fontSize: number
  lineHeight: number
  theme: ThemeKey
  onChangeFontSize: (v: number) => void
  onChangeLineHeight: (v: number) => void
  onChangeTheme: (t: ThemeKey) => void
  onClose: () => void
}

const FONT_SIZES = [14, 16, 18, 20, 22, 24]
const LINE_HEIGHTS = [1.3, 1.5, 1.7, 1.9, 2.1]

const READING_SWATCH: Record<ThemeKey, { bg: string; text: string }> = {
  light: { bg: Colors.light.bgReading, text: Colors.light.textPrimary },
  sepia: { bg: Colors.light.bgReadingSepia, text: Colors.light.textOnSepia },
  dark: { bg: Colors.dark.bgReading, text: Colors.dark.textPrimary },
}

export function SettingsSheet({
  visible,
  fontSize,
  lineHeight,
  theme,
  onChangeFontSize,
  onChangeLineHeight,
  onChangeTheme,
  onClose,
}: SettingsSheetProps) {
  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      scroll={false}
      contentContainerStyle={{ paddingHorizontal: 24 }}
    >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="font-display text-lg text-text-primary-light dark:text-text-primary-dark">
              Reading settings
            </Text>
            <Pressable onPress={onClose}>
              <Text className="font-ui text-brand-text-light dark:text-brand-text-dark">Done</Text>
            </Pressable>
          </View>

          <Text className="font-ui text-sm mb-2 text-text-secondary-light dark:text-text-secondary-dark">
            Font size
          </Text>
          <View className="flex-row gap-2 mb-5">
            {FONT_SIZES.map((s) => {
              const active = s === fontSize
              return (
                <Pressable
                  key={s}
                  onPress={() => onChangeFontSize(s)}
                  className={
                    active
                      ? 'rounded-lg px-3 py-2 border bg-brand-ui-light dark:bg-brand-ui-dark border-border-interactive-light dark:border-border-interactive-dark'
                      : 'rounded-lg px-3 py-2 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark'
                  }
                >
                  <Text
                    className={
                      active
                        ? 'font-ui text-text-on-brand'
                        : 'font-ui text-text-primary-light dark:text-text-primary-dark'
                    }
                  >
                    {s}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Text className="font-ui text-sm mb-2 text-text-secondary-light dark:text-text-secondary-dark">
            Line height
          </Text>
          <View className="flex-row gap-2 mb-5">
            {LINE_HEIGHTS.map((h) => {
              const active = h === lineHeight
              return (
                <Pressable
                  key={h}
                  onPress={() => onChangeLineHeight(h)}
                  className={
                    active
                      ? 'rounded-lg px-3 py-2 border bg-brand-ui-light dark:bg-brand-ui-dark border-border-interactive-light dark:border-border-interactive-dark'
                      : 'rounded-lg px-3 py-2 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark'
                  }
                >
                  <Text
                    className={
                      active
                        ? 'font-ui text-text-on-brand'
                        : 'font-ui text-text-primary-light dark:text-text-primary-dark'
                    }
                  >
                    {h}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Text className="font-ui text-sm mb-2 text-text-secondary-light dark:text-text-secondary-dark">
            Reading theme
          </Text>
          <View className="flex-row gap-2">
            {(['light', 'sepia', 'dark'] as const).map((t) => {
              const active = t === theme
              const swatch = READING_SWATCH[t]
              return (
                <Pressable
                  key={t}
                  onPress={() => onChangeTheme(t)}
                  className="flex-1 rounded-lg py-3 items-center"
                  style={{
                    backgroundColor: swatch.bg,
                    borderWidth: 2,
                    borderColor: active ? Colors.light.brandUi : 'transparent',
                  }}
                >
                  <Text
                    className="font-ui capitalize"
                    style={{ color: swatch.text }}
                  >
                    {active ? '◉ ' : ''}
                    {t}
                  </Text>
                </Pressable>
              )
            })}
          </View>
    </SheetScaffold>
  )
}
