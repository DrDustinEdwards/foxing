import { View, Text, Modal, Pressable } from 'react-native'
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl px-6 pt-6 pb-10"
          style={{ backgroundColor: '#2A1F0F' }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-serif" style={{ color: '#C4973A' }}>
              Reading settings
            </Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: '#8B6914' }}>Done</Text>
            </Pressable>
          </View>

          <Text className="text-sm mb-2" style={{ color: '#8B6914' }}>
            Font size
          </Text>
          <View className="flex-row gap-2 mb-5">
            {FONT_SIZES.map((s) => {
              const active = s === fontSize
              return (
                <Pressable
                  key={s}
                  onPress={() => onChangeFontSize(s)}
                  className="rounded-lg px-3 py-2"
                  style={{
                    backgroundColor: active ? '#8B6914' : '#1A1208',
                    borderWidth: 1,
                    borderColor: active ? '#C4973A' : '#3D2B1F',
                  }}
                >
                  <Text style={{ color: active ? '#FDF8F0' : '#E8D5B0' }}>{s}</Text>
                </Pressable>
              )
            })}
          </View>

          <Text className="text-sm mb-2" style={{ color: '#8B6914' }}>
            Line height
          </Text>
          <View className="flex-row gap-2 mb-5">
            {LINE_HEIGHTS.map((h) => {
              const active = h === lineHeight
              return (
                <Pressable
                  key={h}
                  onPress={() => onChangeLineHeight(h)}
                  className="rounded-lg px-3 py-2"
                  style={{
                    backgroundColor: active ? '#8B6914' : '#1A1208',
                    borderWidth: 1,
                    borderColor: active ? '#C4973A' : '#3D2B1F',
                  }}
                >
                  <Text style={{ color: active ? '#FDF8F0' : '#E8D5B0' }}>{h}</Text>
                </Pressable>
              )
            })}
          </View>

          <Text className="text-sm mb-2" style={{ color: '#8B6914' }}>
            Theme
          </Text>
          <View className="flex-row gap-2">
            {(['light', 'sepia', 'dark'] as const).map((t) => {
              const active = t === theme
              const swatch =
                t === 'light'
                  ? Colors.background.light
                  : t === 'sepia'
                  ? Colors.background.sepia
                  : Colors.background.dark
              return (
                <Pressable
                  key={t}
                  onPress={() => onChangeTheme(t)}
                  className="flex-1 rounded-lg py-3 items-center"
                  style={{
                    backgroundColor: swatch,
                    borderWidth: 2,
                    borderColor: active ? '#C4973A' : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: t === 'dark' ? Colors.text.dark : Colors.text.light,
                      textTransform: 'capitalize',
                    }}
                  >
                    {t}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
