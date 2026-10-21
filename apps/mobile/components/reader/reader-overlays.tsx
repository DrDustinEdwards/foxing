import { useColors } from '@/constants/colors'
import { useEffect, useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pressable, Modal as RNModal, TextInput as RNTextInput, Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'

// Lightweight transient toast, single instance, auto-dismisses. Kept local
// to the reader because no other screen needs it yet.
export function ReaderToast({ message, onHide }: { message: string | null; onHide: () => void }) {
  const colors = useColors()
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onHide, 2500)
    return () => clearTimeout(t)
  }, [message, onHide])
  if (!message) return null
  return (
    <SafeAreaView
      edges={['bottom']}
      pointerEvents="none"
      className="absolute bottom-0 left-0 right-0"
    >
      <View
        className="mx-6 mb-6 px-4 py-3 rounded-xl"
        style={{ backgroundColor: colors.tooltipBg, alignItems: 'center' }}
      >
        <Text
          style={{
            color: colors.tooltipText,
            fontFamily: Fonts.uiMedium,
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          {message}
        </Text>
      </View>
    </SafeAreaView>
  )
}

// Inline modal for naming a fresh bookmark. Defaults to "[Chapter] · X%"
// so a confused user can just hit Save without typing anything.
export function BookmarkNamingModal({
  suggested,
  onCancel,
  onSave,
}: {
  suggested: string
  onCancel: () => void
  onSave: (name: string) => void | Promise<void>
}) {
  const colors = useColors()
  const [name, setName] = useState(suggested)
  return (
    <RNModal visible animationType="fade" transparent onRequestClose={onCancel}>
      <Pressable
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: colors.overlay }}
        onPress={onCancel}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full p-4 rounded-2xl bg-bg-elevated-light dark:bg-bg-elevated-dark"
        >
          <Text
            style={{
              fontFamily: Fonts.displayBold,
              fontSize: 16,
              color: colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Name this bookmark
          </Text>
          <RNTextInput
            value={name}
            onChangeText={setName}
            placeholder={suggested}
            placeholderTextColor={colors.textTertiary}
            maxLength={80}
            autoFocus
            style={{
              fontFamily: Fonts.body,
              fontSize: 15,
              color: colors.textPrimary,
              backgroundColor: colors.bgBase,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 12,
            }}
          />
          <View className="flex-row justify-end gap-3">
            <Pressable onPress={onCancel} className="px-4 py-2">
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textSecondary }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(name.trim() || suggested)}
              className="px-4 py-2 rounded-full"
              style={{ backgroundColor: colors.brandUi }}
            >
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                Save
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </RNModal>
  )
}
