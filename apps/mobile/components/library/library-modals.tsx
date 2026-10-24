import { useColors } from '@/constants/colors'
import { useEffect, useState } from 'react'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Fonts } from '@/constants/fonts'

export function CreateShelfModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean
  onClose: () => void
  onCreate: (name: string) => Promise<void> | void
}) {
  const colors = useColors()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setName('')
      setSaving(false)
    }
  }, [visible])

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      stickyFooter
      contentContainerStyle={{ paddingHorizontal: 16 }}
      header={
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 16,
            color: colors.textPrimary,
            marginBottom: 12,
            paddingHorizontal: 16,
          }}
        >
          New shelf
        </Text>
      }
      footer={
        <View className="flex-row justify-end gap-3">
          <Pressable onPress={onClose} className="px-4 py-2">
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textSecondary }}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              if (!name.trim() || saving) return
              setSaving(true)
              await onCreate(name.trim())
              setSaving(false)
              onClose()
            }}
            disabled={!name.trim() || saving}
            className="px-4 py-2 rounded-full"
            style={{
              backgroundColor: name.trim() ? colors.brandUi : colors.bgDisabled,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
              Create
            </Text>
          </Pressable>
        </View>
      }
    >
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name your shelf"
            placeholderTextColor={colors.textTertiary}
            maxLength={40}
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
    </SheetScaffold>
  )
}
