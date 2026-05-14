import { useState } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { chatWithCompanion } from '@/lib/claude'
import { useColors } from '@/constants/colors'

interface CompanionChatProps {
  visible: boolean
  bookTitle: string
  author: string
  currentChapter: string
  onClose: () => void
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function CompanionChat({
  visible,
  bookTitle,
  author,
  currentChapter,
  onClose,
}: CompanionChatProps) {
  const colors = useColors()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [spoilerFree, setSpoilerFree] = useState(true)

  async function send() {
    if (!input.trim() || sending) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const updated = [...messages, userMsg]
    console.log('[companion-chat] send', {
      turn: updated.length,
      currentChapter,
      spoilerFree,
    })
    setMessages(updated)
    setInput('')
    setSending(true)
    try {
      const reply = await chatWithCompanion(
        updated,
        bookTitle,
        author,
        currentChapter,
        spoilerFree
      )
      console.log('[companion-chat] reply', { chars: reply.length })
      setMessages([...updated, { role: 'assistant', content: reply }])
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sorry, something went wrong.'
      console.warn('[companion-chat] error', message)
      setMessages([
        ...updated,
        { role: 'assistant', content: `Error: ${message}` },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border-subtle-light dark:border-border-subtle-dark">
            <View>
              <Text className="font-display text-lg text-text-primary-light dark:text-text-primary-dark">
                Companion
              </Text>
              <Text
                className="font-ui text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
                numberOfLines={1}
              >
                {bookTitle}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center">
                <Text className="font-ui text-xs mr-2 text-text-secondary-light dark:text-text-secondary-dark">
                  Spoiler-free
                </Text>
                <Switch
                  value={spoilerFree}
                  onValueChange={setSpoilerFree}
                  trackColor={{ true: colors.brandUi, false: colors.borderDefault }}
                  thumbColor={colors.bgSurface}
                />
              </View>
              <Pressable onPress={onClose}>
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
            {sending ? <ActivityIndicator color={colors.brandUi} className="mt-2" /> : null}
          </ScrollView>

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
              className="rounded-full px-4 py-3 bg-brand-ui-light dark:bg-brand-ui-dark"
              style={{ opacity: sending || !input.trim() ? 0.5 : 1 }}
            >
              <Text className="font-ui-medium text-text-on-brand">Send</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}
