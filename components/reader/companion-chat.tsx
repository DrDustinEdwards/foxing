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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [spoilerFree, setSpoilerFree] = useState(true)

  async function send() {
    if (!input.trim() || sending) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const updated = [...messages, userMsg]
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
      setMessages([...updated, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages([
        ...updated,
        {
          role: 'assistant',
          content: e instanceof Error ? `Error: ${e.message}` : 'Sorry, something went wrong.',
        },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: '#1A1208' }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <View
            className="flex-row items-center justify-between px-4 py-3"
            style={{ borderBottomWidth: 1, borderBottomColor: '#3D2B1F' }}
          >
            <View>
              <Text className="font-serif text-lg" style={{ color: '#C4973A' }}>
                Companion
              </Text>
              <Text className="text-xs" style={{ color: '#8B6914' }} numberOfLines={1}>
                {bookTitle}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center">
                <Text className="text-xs mr-2" style={{ color: '#8B6914' }}>
                  Spoiler-free
                </Text>
                <Switch
                  value={spoilerFree}
                  onValueChange={setSpoilerFree}
                  trackColor={{ true: '#8B6914', false: '#3D2B1F' }}
                />
              </View>
              <Pressable onPress={onClose}>
                <Text style={{ color: '#C4973A' }}>Close</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16 }}>
            {messages.length === 0 ? (
              <Text className="text-sm mt-8 text-center" style={{ color: '#8B6914' }}>
                Ask anything about {bookTitle}.
              </Text>
            ) : (
              messages.map((m, i) => (
                <View
                  key={i}
                  className="mb-3 rounded-2xl px-4 py-3"
                  style={{
                    backgroundColor: m.role === 'user' ? '#8B6914' : '#2A1F0F',
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}
                >
                  <Text style={{ color: m.role === 'user' ? '#FDF8F0' : '#E8D5B0' }}>
                    {m.content}
                  </Text>
                </View>
              ))
            )}
            {sending ? <ActivityIndicator color="#8B6914" className="mt-2" /> : null}
          </ScrollView>

          <View
            className="flex-row items-center px-4 py-3 gap-2"
            style={{ borderTopWidth: 1, borderTopColor: '#3D2B1F' }}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask something…"
              placeholderTextColor="#8B6914"
              className="flex-1 rounded-full px-4 py-3"
              style={{ backgroundColor: '#2A1F0F', color: '#E8D5B0' }}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <Pressable
              onPress={send}
              disabled={sending || !input.trim()}
              className="rounded-full px-4 py-3"
              style={{ backgroundColor: '#8B6914', opacity: sending || !input.trim() ? 0.5 : 1 }}
            >
              <Text style={{ color: '#FDF8F0' }}>Send</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}
