import { View, Text, Pressable, TextInput } from 'react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// Pause confirmation + optional note. Centered modal, pauses are intentional
// and the note tends to be a sentence at most, so a small dialog fits.
export function PauseNoteModal({
  visible,
  note,
  onChangeNote,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  note: string
  onChangeNote: (v: string) => void
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  const colors = useColors()
  return (
    <SheetScaffold
      visible={visible}
      onClose={onCancel}
      variant="bottom"
      stickyFooter
      contentContainerStyle={{ paddingHorizontal: 20 }}
      header={
        <View style={{ paddingHorizontal: 20 }}>
          <Text
            style={{
              fontFamily: Fonts.displayBold,
              fontSize: 16,
              color: colors.textPrimary,
              marginBottom: 6,
            }}
          >
            Pause reading
          </Text>
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 13,
              color: colors.textSecondary,
              marginBottom: 12,
            }}
          >
            Why are you pausing? (optional)
          </Text>
        </View>
      }
      footer={
        <View className="flex-row justify-end" style={{ gap: 10 }}>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            className="px-4 py-2"
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textSecondary }}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel="Pause book"
            className="px-4 py-2 rounded-full"
            style={{ backgroundColor: colors.brandUi }}
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
              Pause
            </Text>
          </Pressable>
        </View>
      }
    >
          <TextInput
            value={note}
            onChangeText={onChangeNote}
            placeholder="Taking a break, life got busy..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={280}
            accessibilityLabel="Pause note"
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textPrimary,
              backgroundColor: colors.bgBase,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              minHeight: 80,
              textAlignVertical: 'top',
              marginBottom: 12,
            }}
          />
    </SheetScaffold>
  )
}
