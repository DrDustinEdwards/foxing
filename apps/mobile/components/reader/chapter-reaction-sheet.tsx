import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { PrivacySelector, type PrivacyTier } from '@/components/privacy-selector'

// Chapter reaction sheet, slides up under the chrome after a chapter ends.
// Auto-dismisses after 8 seconds of inactivity so it doesn't linger over
// the next chapter. Skip is always visible.

export const CHAPTER_REACTION_EMOJIS = ['😮', '🔥', '💙', '😢', '😂', '🤯', '❤️'] as const

interface ChapterReactionSheetProps {
  visible: boolean
  chapterTitle: string
  onSave: (emoji: string, note: string, privacy: PrivacyTier) => void | Promise<void>
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 8000

export function ChapterReactionSheet({
  visible,
  chapterTitle,
  onSave,
  onDismiss,
}: ChapterReactionSheetProps) {
  const colors = useColors()
  const [emoji, setEmoji] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [privacy, setPrivacy] = useState<PrivacyTier>('public')
  // Track whether the user has interacted; if they have, we don't auto-
  // dismiss while they're still composing.
  const interactedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!visible) return
    interactedRef.current = false
    setEmoji(null)
    setNote('')
    setPrivacy('public')
    timerRef.current = setTimeout(() => {
      if (!interactedRef.current) onDismiss()
    }, AUTO_DISMISS_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [visible, onDismiss])

  function markInteracted() {
    interactedRef.current = true
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  if (!visible) return null

  return (
    <SafeAreaView
      edges={['bottom']}
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0"
    >
      <View
        className="mx-4 mb-4 p-4 rounded-2xl border bg-bg-elevated-light dark:bg-bg-elevated-dark border-border-subtle-light dark:border-border-subtle-dark"
        accessibilityViewIsModal
        accessibilityLabel={`Reaction to ${chapterTitle}`}
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
          elevation: 8,
        }}
      >
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 13,
            color: colors.textPrimary,
            marginBottom: 10,
          }}
          numberOfLines={1}
        >
          How was {chapterTitle || 'that chapter'}?
        </Text>
        <View className="flex-row justify-between" style={{ marginBottom: 10 }}>
          {CHAPTER_REACTION_EMOJIS.map((e) => {
            const active = emoji === e
            return (
              <Pressable
                key={e}
                onPress={() => {
                  markInteracted()
                  setEmoji(active ? null : e)
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Reaction ${e}`}
                hitSlop={4}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.bgSelected : 'transparent',
                  borderWidth: active ? 2 : 0,
                  borderColor: active ? colors.borderBrand : 'transparent',
                }}
              >
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            )
          })}
        </View>
        <TextInput
          value={note}
          onChangeText={(t) => {
            markInteracted()
            setNote(t.slice(0, 140))
          }}
          placeholder="Add a thought..."
          placeholderTextColor={colors.textTertiary}
          maxLength={140}
          accessibilityLabel="Chapter reaction note"
          style={{
            fontFamily: Fonts.body,
            fontSize: 13,
            color: colors.textPrimary,
            backgroundColor: colors.bgBase,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 8,
            marginBottom: 10,
          }}
        />
        <View style={{ marginBottom: 10 }}>
          <PrivacySelector
            value={privacy}
            onChange={(p) => {
              markInteracted()
              setPrivacy(p)
            }}
            dense
          />
        </View>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => {
              markInteracted()
              onDismiss()
            }}
            accessibilityRole="button"
            accessibilityLabel="Skip"
            className="px-3 py-2"
          >
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textTertiary }}
            >
              Skip
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!emoji) return
              onSave(emoji, note.trim(), privacy)
            }}
            disabled={!emoji}
            accessibilityRole="button"
            accessibilityLabel="Save reaction"
            accessibilityState={{ disabled: !emoji }}
            className="px-4 py-2 rounded-full"
            style={{
              backgroundColor: emoji ? colors.brandUi : colors.bgDisabled,
            }}
          >
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textOnBrand }}
            >
              Save
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}
