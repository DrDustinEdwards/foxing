import { useState } from 'react'
import { View, Text, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native'
import { analyzePassage } from '@/lib/claude'

type Mode = 'rewrite' | 'historical' | 'literary' | 'thematic' | 'motivation'

const MODES: Array<{ key: Mode; label: string }> = [
  { key: 'rewrite', label: 'Plain English' },
  { key: 'historical', label: 'Historical Context' },
  { key: 'literary', label: 'Literary Devices' },
  { key: 'thematic', label: 'Themes' },
  { key: 'motivation', label: 'Character Motivation' },
]

interface PassageAnalysisSheetProps {
  visible: boolean
  passage: string
  bookTitle: string
  author: string
  era: string
  onClose: () => void
}

export function PassageAnalysisSheet({
  visible,
  passage,
  bookTitle,
  author,
  era,
  onClose,
}: PassageAnalysisSheetProps) {
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<Mode | null>(null)

  async function run(mode: Mode) {
    setActiveMode(mode)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const text = await analyzePassage(passage, mode, bookTitle, author, era)
      setResult(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setActiveMode(null)
    setResult(null)
    setError(null)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable className="flex-1 justify-end" onPress={handleClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl px-6 pt-6 pb-10"
          style={{ backgroundColor: '#2A1F0F', maxHeight: '85%' }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-serif" style={{ color: '#C4973A' }}>
              Passage analysis
            </Text>
            <Pressable onPress={handleClose}>
              <Text style={{ color: '#8B6914' }}>Close</Text>
            </Pressable>
          </View>

          <View
            className="rounded-lg p-3 mb-4"
            style={{ backgroundColor: '#1A1208', maxHeight: 100 }}
          >
            <Text className="italic text-sm" style={{ color: '#E8D5B0' }} numberOfLines={4}>
              "{passage}"
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {MODES.map((m) => {
                const active = activeMode === m.key
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => run(m.key)}
                    className="rounded-full px-3 py-2"
                    style={{
                      backgroundColor: active ? '#8B6914' : '#1A1208',
                      borderWidth: 1,
                      borderColor: active ? '#C4973A' : '#3D2B1F',
                    }}
                  >
                    <Text className="text-xs" style={{ color: active ? '#FDF8F0' : '#E8D5B0' }}>
                      {m.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </ScrollView>

          <ScrollView>
            {loading ? (
              <ActivityIndicator color="#8B6914" />
            ) : error ? (
              <Text style={{ color: '#D32F2F' }}>{error}</Text>
            ) : result ? (
              <Text className="text-base leading-7" style={{ color: '#E8D5B0' }}>
                {result}
              </Text>
            ) : (
              <Text className="text-sm" style={{ color: '#8B6914' }}>
                Pick an analysis above to begin.
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
