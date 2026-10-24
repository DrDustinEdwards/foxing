import { useCompanion } from '@foxing/client'
import { useEffect, useState } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { KeyboardStickyView } from 'react-native-keyboard-controller'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface CompanionChatProps {
  visible: boolean
  bookTitle: string
  bookId: string
  // When set, the chat opens with this text ready in the box (a quoted passage or
  // word), for the reader to finish their question.
  seedQuestion?: string | null
  onClose: () => void
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// A conversation about the book. The server keeps the thread and its history; the
// companion avoids spoilers past what the reader has mentioned.
export function CompanionChat({ visible, bookTitle, bookId, seedQuestion, onClose }: CompanionChatProps) {
  const colors = useColors()
  const companion = useCompanion()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const sending = companion.pending

  useEffect(() => {
    if (!visible) return
    companion.reset()
    setMessages([])
    setInput(seedQuestion ?? '')
  }, [visible, seedQuestion])

  async function send() {
    const message = input.trim()
    if (!message || sending) return
    const updated = [...messages, { role: 'user' as const, content: message }]
    setMessages(updated)
    setInput('')
    const reply = await companion.run({
      action: 'chat',
      bookId,
      message,
      threadId: companion.threadId ?? undefined,
    })
    if (reply) setMessages([...updated, { role: 'assistant', content: reply }])
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border-subtle-light dark:border-border-subtle-dark">
            <View style={{ flex: 1 }}>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Text className="font-display text-lg text-text-primary-light dark:text-text-primary-dark">
                  AI Companion
                </Text>
              </View>
              <Text
                className="font-ui text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
                numberOfLines={1}
              >
                {bookTitle}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close companion chat"
              >
                <Text className="font-ui text-brand-text-light dark:text-brand-text-dark">
                  Close
                </Text>
              </Pressable>
            </View>
          </View>

          <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16 }}>
            {messages.length === 0 ? (
              <Text className="font-ui text-sm mt-8 text-center text-text-tertiary-light dark:text-text-tertiary-dark">
                Ask anything about {bookTitle}.
              </Text>
            ) : (
              messages.map((m, i) => (
                <View
                  key={i}
                  className={
                    m.role === 'user'
                      ? 'mb-3 rounded-2xl px-4 py-3 self-end bg-brand-ui-light dark:bg-brand-ui-dark'
                      : 'mb-3 rounded-2xl px-4 py-3 self-start bg-bg-surface-light dark:bg-bg-surface-dark border border-border-subtle-light dark:border-border-subtle-dark'
                  }
                  style={{ maxWidth: '85%' }}
                >
                  <Text
                    className={
                      m.role === 'user'
                        ? 'font-body text-text-on-brand'
                        : 'font-body text-text-primary-light dark:text-text-primary-dark'
                    }
                  >
                    {m.content}
                  </Text>
                </View>
              ))
            )}
            {sending && companion.text ? (
              <View
                className="mb-3 rounded-2xl px-4 py-3 self-start bg-bg-surface-light dark:bg-bg-surface-dark border border-border-subtle-light dark:border-border-subtle-dark"
                style={{ maxWidth: '85%' }}
              >
                <Text className="font-body text-text-primary-light dark:text-text-primary-dark">{companion.text}</Text>
              </View>
            ) : sending ? (
              <ActivityIndicator color={colors.brandUi} className="mt-2" />
            ) : null}
            {companion.planRequired ? (
              <Pressable onPress={() => Linking.openURL('https://foxing.app/pricing')} accessibilityRole="link">
                <Text style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.brandText, marginTop: 8 }}>
                  The companion is a Foxing Plus feature. See Foxing Plus
                </Text>
              </Pressable>
            ) : companion.error ? (
              <Text accessibilityRole="alert" style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textSecondary, marginTop: 8 }}>
                {companion.error}
              </Text>
            ) : null}
          </ScrollView>

          <KeyboardStickyView>
          <View className="flex-row items-center px-4 py-3 gap-2 border-t border-border-subtle-light dark:border-border-subtle-dark">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask something…"
              placeholderTextColor={colors.textTertiary}
              className="font-ui flex-1 rounded-full px-4 py-3 bg-bg-surface-light dark:bg-bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-interactive-light dark:border-border-interactive-dark"
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <Pressable
              onPress={send}
              disabled={sending || !input.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: sending || !input.trim(), busy: sending }}
              className="rounded-full px-4 py-3 bg-brand-ui-light dark:bg-brand-ui-dark"
              style={{ opacity: sending || !input.trim() ? 0.5 : 1 }}
            >
              <Text className="font-ui-medium text-text-on-brand">Send</Text>
            </Pressable>
          </View>
          </KeyboardStickyView>
      </SafeAreaView>
    </Modal>
  )
}
