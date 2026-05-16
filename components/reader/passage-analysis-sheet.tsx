import { useState } from 'react'
import { View, Text, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native'
import { X as XIcon } from 'phosphor-react-native'
import { analyzePassage } from '@/lib/claude'
import { useColors } from '@/constants/colors'

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
  bookId?: string
  currentChapter?: string
  progress?: number
  onClose: () => void
}

export function PassageAnalysisSheet({
  visible,
  passage,
  bookTitle,
  author,
  era,
  bookId,
  currentChapter,
  progress,
  onClose,
}: PassageAnalysisSheetProps) {
  const colors = useColors()
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<Mode | null>(null)

  async function run(mode: Mode) {
    console.log('[passage-analysis] run', { mode, passageChars: passage.length })
    setActiveMode(mode)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const text = await analyzePassage(passage, mode, bookTitle, author, era, {
        bookId,
        currentChapter,
        progress,
      })
      console.log('[passage-analysis] result', { mode, chars: text.length })
      setResult(text)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Analysis failed'
      console.warn('[passage-analysis] error', message)
      setError(message)
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
          className="rounded-t-3xl px-6 pt-6 pb-10 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
          style={{ maxHeight: '85%' }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="font-display text-lg text-text-primary-light dark:text-text-primary-dark">
              Passage analysis
            </Text>
            <Pressable onPress={handleClose}>
              <Text className="font-ui text-brand-text-light dark:text-brand-text-dark">Close</Text>
            </Pressable>
          </View>

          <View
            className="rounded-lg p-3 mb-4 bg-bg-sunken-light dark:bg-bg-sunken-dark border-l-4 border-border-brand-light dark:border-border-brand-dark"
            style={{ maxHeight: 100 }}
          >
            <Text
              className="font-body italic text-sm text-text-secondary-light dark:text-text-secondary-dark"
              numberOfLines={4}
            >
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
                    className={
                      active
                        ? 'rounded-full px-3 py-2 border bg-brand-ui-light dark:bg-brand-ui-dark border-border-interactive-light dark:border-border-interactive-dark'
                        : 'rounded-full px-3 py-2 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark'
                    }
                  >
                    <Text
                      className={
                        active
                          ? 'font-ui text-xs text-text-on-brand'
                          : 'font-ui text-xs text-text-primary-light dark:text-text-primary-dark'
                      }
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </ScrollView>

          {/* Result ScrollView gets flex:1 so it bounds within the sheet's
              maxHeight; otherwise long passage analyses overflow the sheet
              without scrolling. */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {loading ? (
              <ActivityIndicator color={colors.brandUi} />
            ) : error ? (
              <View className="flex-row items-start gap-2 rounded-lg px-3 py-2 bg-error-bg-light dark:bg-error-bg-dark">
                <XIcon color={colors.error} size={16} />
                <Text className="font-ui flex-1 text-error-light dark:text-error-dark">
                  {error}
                </Text>
              </View>
            ) : result ? (
              <Text className="font-body text-base leading-7 text-text-primary-light dark:text-text-primary-dark">
                {result}
              </Text>
            ) : (
              <Text className="font-ui text-sm text-text-tertiary-light dark:text-text-tertiary-dark">
                Pick an analysis above to begin.
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
