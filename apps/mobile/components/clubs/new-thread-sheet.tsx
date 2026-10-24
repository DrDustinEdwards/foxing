import { useCreateThread } from '@foxing/client'
import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  Switch,
} from 'react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { X as XIcon } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export function NewThreadSheet({
  visible,
  clubId,
  defaultChapter,
  onClose,
  onPosted,
}: {
  visible: boolean
  clubId: string
  defaultChapter: string
  onClose: () => void
  onPosted: (threadId: string) => void
}) {
  const colors = useColors()
  const [title, setTitle] = useState('')
  const [opening, setOpening] = useState('')
  const [chapter, setChapter] = useState(defaultChapter)
  const [hasSpoilers, setHasSpoilers] = useState(false)
  const createThread = useCreateThread()
  const busy = createThread.pending

  useEffect(() => {
    if (visible) {
      setTitle('')
      setOpening('')
      setChapter(defaultChapter)
      setHasSpoilers(false)
      createThread.reset()
    }
  }, [visible, defaultChapter, createThread.reset])

  const post = useCallback(async () => {
    if (!title.trim() || busy) return
    const res = await createThread.run({
      clubId,
      title: title.trim(),
      chapter: chapter.trim() || undefined,
      body: opening.trim() || undefined,
      hasSpoilers,
    })
    if (res) onPosted(res.thread.id)
  }, [busy, chapter, clubId, createThread, hasSpoilers, onPosted, opening, title])

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      header={
        <View className="flex-row items-center justify-between px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
            <XIcon color={colors.textPrimary} size={20} />
          </Pressable>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}>
            New thread
          </Text>
          <View style={{ width: 36 }} />
        </View>
      }
      footer={
        <View className="flex-row items-center justify-end" style={{ gap: 12 }}>
          {createThread.error ? (
            <Text style={{ flex: 1, fontFamily: Fonts.ui, fontSize: 12, color: colors.error }}>
              {createThread.error}
            </Text>
          ) : null}
          <Pressable
            onPress={post}
            disabled={!title.trim() || busy}
            className="px-5 py-2 rounded-full"
            style={{
              backgroundColor: title.trim() ? colors.brandUi : colors.bgDisabled,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.textOnBrand} size="small" />
            ) : (
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                Post
              </Text>
            )}
          </Pressable>
        </View>
      }
    >
            <Text style={fieldLabelStyle(colors)}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What do you want to discuss?"
              placeholderTextColor={colors.textTertiary}
              maxLength={120}
              style={inputStyle(colors)}
            />
            <Text style={fieldLabelStyle(colors)}>Chapter (optional)</Text>
            <TextInput
              value={chapter}
              onChangeText={setChapter}
              placeholder="Chapter or section"
              placeholderTextColor={colors.textTertiary}
              maxLength={120}
              style={inputStyle(colors)}
            />
            <Text style={fieldLabelStyle(colors)}>Opening post (optional)</Text>
            <TextInput
              value={opening}
              onChangeText={setOpening}
              placeholder="Set the scene for the discussion…"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={{ ...inputStyle(colors), height: 160, textAlignVertical: 'top' }}
            />
            <View
              className="flex-row items-center justify-between mt-3 p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
                Mark as containing spoilers
              </Text>
              <Switch
                value={hasSpoilers}
                onValueChange={setHasSpoilers}
                trackColor={{ false: colors.bgDisabled, true: colors.toggleOn }}
              />
            </View>
    </SheetScaffold>
  )
}

function fieldLabelStyle(colors: ReturnType<typeof useColors>) {
  return {
    fontFamily: Fonts.uiMedium,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  }
}

function inputStyle(colors: ReturnType<typeof useColors>) {
  return {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as const
}
