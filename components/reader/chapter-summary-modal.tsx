import { useEffect, useState } from 'react'
import { View, Text, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native'
import { getChapterSummary } from '@/lib/claude'

interface ChapterSummaryModalProps {
  visible: boolean
  chapterTitle: string
  chapterNumber: number
  bookTitle: string
  author: string
  timing: 'before' | 'after'
  onClose: () => void
}

export function ChapterSummaryModal({
  visible,
  chapterTitle,
  chapterNumber,
  bookTitle,
  author,
  timing,
  onClose,
}: ChapterSummaryModalProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    setError(null)
    setSummary(null)
    ;(async () => {
      try {
        const s = await getChapterSummary(chapterTitle, chapterNumber, timing, bookTitle, author)
        setSummary(s)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Summary failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [visible, chapterTitle, chapterNumber, timing, bookTitle, author])

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center px-6" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-2xl p-6 w-full"
          style={{ backgroundColor: '#2A1F0F', maxHeight: '80%' }}
        >
          <Text className="text-lg font-serif mb-2" style={{ color: '#C4973A' }}>
            {timing === 'before' ? 'Catch up' : 'Recap'}
          </Text>
          <Text className="text-xs mb-4" style={{ color: '#8B6914' }}>
            {chapterTitle}
          </Text>
          <ScrollView>
            {loading ? (
              <ActivityIndicator color="#8B6914" />
            ) : error ? (
              <Text style={{ color: '#D32F2F' }}>{error}</Text>
            ) : (
              <Text className="leading-7" style={{ color: '#E8D5B0' }}>
                {summary}
              </Text>
            )}
          </ScrollView>
          <Pressable
            onPress={onClose}
            className="mt-4 rounded-xl py-3 items-center"
            style={{ backgroundColor: '#8B6914' }}
          >
            <Text style={{ color: '#FDF8F0' }}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
