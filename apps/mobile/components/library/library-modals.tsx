import { useColors } from '@/constants/colors'
import { useEffect, useState } from 'react'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View } from 'react-native'
import { Fonts } from '@/constants/fonts'
import type { BookRow } from '@/components/library/library-types'
import { X as XIcon } from 'phosphor-react-native'
import { saveReview } from '@/lib/library'

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

export function ReviewModal({
  row,
  onClose,
  onSaved,
}: {
  row: BookRow
  onClose: () => void
  onSaved: (review: string, isPublic: boolean) => void
}) {
  const colors = useColors()
  const [text, setText] = useState(row.review ?? '')
  const [isPublic, setIsPublic] = useState(!!row.review_is_public)
  const [saving, setSaving] = useState(false)

  return (
    <SheetScaffold
      visible
      onClose={onClose}
      contentContainerStyle={{ padding: 16 }}
      header={
        <View className="flex-row items-center justify-between px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
            <XIcon color={colors.textPrimary} size={20} />
          </Pressable>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}>
            How was {row.book?.title ?? 'this book'}?
          </Text>
          <View style={{ width: 36 }} />
        </View>
      }
      footer={
        <View className="flex-row items-center justify-end">
          <Pressable
            onPress={async () => {
              setSaving(true)
              await saveReview(row.id, text, isPublic)
              setSaving(false)
              onSaved(text, isPublic)
            }}
            disabled={saving}
            className="px-5 py-2 rounded-full"
            style={{ backgroundColor: colors.brandUi, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? (
              <ActivityIndicator color={colors.textOnBrand} size="small" />
            ) : (
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                Save
              </Text>
            )}
          </Pressable>
        </View>
      }
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="280 chars max"
        placeholderTextColor={colors.textTertiary}
        maxLength={280}
        multiline
        style={{
          fontFamily: Fonts.body,
          fontSize: 15,
          color: colors.textPrimary,
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          borderRadius: 12,
          padding: 12,
          minHeight: 140,
          textAlignVertical: 'top',
        }}
      />
      <View
        className="flex-row items-center justify-between mt-3 p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
          Public on my profile
        </Text>
        <Switch
          value={isPublic}
          onValueChange={setIsPublic}
          trackColor={{ false: colors.bgDisabled, true: colors.brandUi }}
        />
      </View>
    </SheetScaffold>
  )
}
