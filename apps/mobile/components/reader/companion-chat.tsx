import { useEffect, useState } from 'react'
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
import { Sliders } from 'phosphor-react-native'
import { chatWithCompanion, friendlyAiError, type ChatMode } from '@/lib/claude'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

const CHAT_MODES: Array<{ id: ChatMode; label: string; subtitle: string }> = [
  { id: 'normal', label: 'Normal', subtitle: 'Warm, conversational fellow reader.' },
  { id: 'spoiler_free', label: 'Spoiler-free', subtitle: 'Locks the spoiler ceiling at your current chapter.' },
  { id: 'socratic', label: 'Socratic', subtitle: 'Answers your questions with questions.' },
  { id: 'debate', label: 'Debate', subtitle: 'Argues the opposite of whatever you say.' },
  { id: 'character_interview', label: 'Character Interview', subtitle: 'Roleplays as a character you pick.' },
  { id: 'author_mode', label: 'Author Mode', subtitle: 'Roleplays as the book\'s author.' },
  { id: 'scholar', label: 'Scholar', subtitle: 'Academic but readable.' },
  { id: 'child_esl', label: 'Child + ESL', subtitle: 'Simple words, short sentences.' },
  { id: 'comparative', label: 'Comparative', subtitle: 'Connects to other books each turn.' },
  { id: 'prediction', label: 'Prediction', subtitle: 'Guesses what happens next (off in spoiler-free).' },
  { id: 'emotional_check_in', label: 'Emotional Check-in', subtitle: 'How the book is landing for you.' },
  { id: 'journal_prompts', label: 'Journal Prompts', subtitle: 'Ends each turn with a prompt to write to.' },
]

interface CompanionChatProps {
  visible: boolean
  bookTitle: string
  author: string
  currentChapter: string
  bookId?: string
  progress?: number
  // When set, the chat opens with this message pre-shown as the assistant's
  // first turn (e.g. "I selected this passage: '...', what would you like
  // to discuss?"). Reset whenever the chat re-opens for a different passage.
  seedAssistantMessage?: string | null
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
  bookId,
  progress,
  seedAssistantMessage,
  onClose,
}: CompanionChatProps) {
  const colors = useColors()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [spoilerFree, setSpoilerFree] = useState(true)
  const [mode, setMode] = useState<ChatMode>('normal')
  const [modePickerOpen, setModePickerOpen] = useState(false)

  // Seed the assistant's opening message every time the chat opens with
  // a (possibly new) seed string. We re-seed on `visible` flips so closing
  // and re-opening with a different passage replaces the seed cleanly.
  useEffect(() => {
    if (!visible) return
    if (seedAssistantMessage) {
      setMessages([{ role: 'assistant', content: seedAssistantMessage }])
    } else {
      setMessages([])
    }
    setInput('')
    setSending(false)
  }, [visible, seedAssistantMessage])

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
        spoilerFree,
        { bookId, progress, mode },
      )
      console.log('[companion-chat] reply', { chars: reply.length })
      setMessages([...updated, { role: 'assistant', content: reply }])
    } catch (e) {
      const message = friendlyAiError(e)
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
            <View style={{ flex: 1 }}>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Text className="font-display text-lg text-text-primary-light dark:text-text-primary-dark">
                  AI Companion
                </Text>
                {/* Mode badge, only renders for non-Normal modes per spec.
                    Normal is the default; an empty header reads cleaner. */}
                {mode !== 'normal' ? (
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 999,
                      backgroundColor: colors.brandSubtle,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 11,
                        color: colors.brandSubtleText,
                      }}
                    >
                      {CHAT_MODES.find((m) => m.id === mode)?.label ?? 'Normal'}
                    </Text>
                  </View>
                ) : null}
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
                onPress={() => setModePickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Change companion mode"
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <Sliders color={colors.textTertiary} size={20} />
              </Pressable>
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

          <ModePickerSheet
            visible={modePickerOpen}
            activeMode={mode}
            onPick={(id) => {
              setMode(id)
              setModePickerOpen(false)
            }}
            onClose={() => setModePickerOpen(false)}
          />

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
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: sending || !input.trim(), busy: sending }}
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

// Bottom-sheet picker for the 12 companion modes. Selected mode gets a
// brand-ui left border + brand-subtle bg per task.md Section A.
function ModePickerSheet({
  visible,
  activeMode,
  onPick,
  onClose,
}: {
  visible: boolean
  activeMode: ChatMode
  onPick: (id: ChatMode) => void
  onClose: () => void
}) {
  const colors = useColors()
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" onPress={onClose} accessibilityLabel="Close mode picker">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
          accessibilityLabel="Companion mode picker"
          className="rounded-t-3xl pt-4 pb-8 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
          style={{ maxHeight: '85%' }}
        >
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary }}>
              Companion mode
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close mode picker"
            >
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
            {CHAT_MODES.map((m) => {
              const active = m.id === activeMode
              return (
                <Pressable
                  key={m.id}
                  onPress={() => onPick(m.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${m.label}, ${m.subtitle}`}
                  className="px-5 py-3"
                  style={{
                    backgroundColor: active ? colors.brandSubtle : 'transparent',
                    borderLeftWidth: 3,
                    borderLeftColor: active ? colors.brandUi : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 14,
                      color: active ? colors.brandSubtleText : colors.textPrimary,
                    }}
                  >
                    {m.label}
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 12,
                      color: colors.textTertiary,
                      marginTop: 2,
                    }}
                  >
                    {m.subtitle}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
