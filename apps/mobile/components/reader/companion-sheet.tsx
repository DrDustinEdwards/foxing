import { type CompanionRequest, useCompanion } from '@foxing/client'
import { X as XIcon } from 'phosphor-react-native'
import { type ReactNode, useEffect } from 'react'
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// One sheet for every single-answer companion action (a word, a passage, a chapter,
// the cast so far, a translation, a search). The server writes the prompt; this
// sends the request when the sheet opens and shows the answer as it streams in.
export function CompanionSheet({
  visible,
  title,
  eyebrow,
  request,
  onClose,
  children,
  footer,
  onAnswer,
}: {
  visible: boolean
  title: string
  /** A small label above the answer: the chapter, or the word. */
  eyebrow?: string | null
  /** Sent when the sheet opens or the request changes; null waits (e.g. for a search query). */
  request: CompanionRequest | null
  onClose: () => void
  /** Shown above the answer, e.g. the search box. */
  children?: ReactNode
  /** Shown under a finished answer, e.g. a save button. */
  footer?: (answer: string) => ReactNode
  /** Called with each finished answer. */
  onAnswer?: (answer: string) => void
}) {
  const colors = useColors()
  const companion = useCompanion()
  const key = request ? JSON.stringify(request) : null

  useEffect(() => {
    if (!visible) {
      companion.reset()
      return
    }
    if (request) void companion.run(request).then((answer) => answer && onAnswer?.(answer))
  }, [visible, key])

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      header={
        <View className="flex-row items-center justify-between px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2" accessibilityLabel="Close">
            <XIcon color={colors.textPrimary} size={20} />
          </Pressable>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}>{title}</Text>
          <View style={{ width: 36 }} />
        </View>
      }
    >
      {children}
      {eyebrow ? (
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 8,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      {companion.planRequired ? (
        <View>
          <Text style={{ fontFamily: Fonts.body, fontSize: 15, color: colors.textPrimary, lineHeight: 22 }}>
            This is a Foxing Plus feature.
          </Text>
          <Pressable
            onPress={() => Linking.openURL('https://foxing.app/pricing')}
            accessibilityRole="link"
            style={{ marginTop: 10 }}
          >
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.brandText }}>See Foxing Plus</Text>
          </Pressable>
        </View>
      ) : companion.error ? (
        <Text accessibilityRole="alert" style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textSecondary }}>
          {companion.error}
        </Text>
      ) : companion.text ? (
        <Text selectable style={{ fontFamily: Fonts.body, fontSize: 16, lineHeight: 25, color: colors.textPrimary }}>
          {companion.text}
        </Text>
      ) : companion.pending ? (
        <ActivityIndicator color={colors.brandUi} style={{ marginTop: 16 }} />
      ) : null}
      {footer && companion.text && !companion.pending ? footer(companion.text) : null}
    </SheetScaffold>
  )
}
