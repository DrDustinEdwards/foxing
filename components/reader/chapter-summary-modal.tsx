import { useEffect, useState } from 'react'
import { View, Text, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native'
import { getChapterSummary } from '@/lib/claude'
import { useColors } from '@/constants/colors'

interface ChapterSummaryModalProps {
  visible: boolean
  chapterTitle: string
  chapterNumber: number
  bookTitle: string
  author: string
  timing: 'before' | 'after'
  bookId?: string
  progress?: number
  onClose: () => void
}

export function ChapterSummaryModal({
  visible,
  chapterTitle,
  chapterNumber,
  bookTitle,
  author,
  timing,
  bookId,
  progress,
  onClose,
}: ChapterSummaryModalProps) {
  const colors = useColors()
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    console.log('[chapter-summary] open', { chapterTitle, chapterNumber, timing })
    setLoading(true)
    setError(null)
    setSummary(null)
    ;(async () => {
      try {
        const s = await getChapterSummary(
          chapterTitle,
          chapterNumber,
          timing,
          bookTitle,
          author,
          undefined,
          { bookId, currentChapter: chapterTitle, progress },
        )
        console.log('[chapter-summary] result', { chars: s.length })
        setSummary(s)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Summary failed'
        console.warn('[chapter-summary] error', message)
        setError(message)
      } finally {
        setLoading(false)
      }
    })()
  }, [visible, chapterTitle, chapterNumber, timing, bookTitle, author])

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable
        className="flex-1 items-center justify-center px-6"
        onPress={onClose}
        style={{ backgroundColor: colors.overlay }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-2xl p-6 w-full bg-bg-elevated-light dark:bg-bg-elevated-dark border border-border-subtle-light dark:border-border-subtle-dark"
          style={{ maxHeight: '80%' }}
        >
          <Text className="font-display text-lg mb-2 text-text-primary-light dark:text-text-primary-dark">
            {timing === 'before' ? 'Catch up' : 'Recap'}
          </Text>
          <Text className="font-ui text-xs mb-4 text-text-tertiary-light dark:text-text-tertiary-dark">
            {chapterTitle}
          </Text>
          {/* flex:1 keeps the body inside the modal's maxHeight bound so
              long summaries scroll instead of pushing the "Got it" button
              off-screen. */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {loading ? (
              <ActivityIndicator color={colors.brandUi} />
            ) : error ? (
              <View className="flex-row items-start gap-2 rounded-lg px-3 py-2 bg-error-bg-light dark:bg-error-bg-dark">
                <Text className="font-ui text-error-light dark:text-error-dark">✕</Text>
                <Text className="font-ui flex-1 text-error-light dark:text-error-dark">
                  {error}
                </Text>
              </View>
            ) : (
              <Text className="font-body leading-7 text-text-primary-light dark:text-text-primary-dark">
                {summary}
              </Text>
            )}
          </ScrollView>
          <Pressable
            onPress={onClose}
            className="mt-4 rounded-xl py-3 items-center bg-brand-ui-light dark:bg-brand-ui-dark"
          >
            <Text className="font-ui-medium text-text-on-brand">Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
