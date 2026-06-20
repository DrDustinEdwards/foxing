import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
} from 'react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { X as XIcon } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  friendlyAiError,
  getChapterFeature,
  getComprehensionQuiz,
  type ChapterFeatureKind,
  type QuizQuestion,
} from '@/lib/claude'
import { ChapterFeatureContent } from './chapter-feature-content'

export const CHAPTER_FEATURES: Array<{ id: ChapterFeatureKind; label: string; subtitle: string }> = [
  { id: 'timeline', label: 'Chapter Timeline', subtitle: 'Events in chronological order.' },
  { id: 'characters', label: 'Chapter Characters', subtitle: 'Who appears, and how they relate.' },
  { id: 'themes', label: 'Chapter Themes', subtitle: 'What this chapter is really about.' },
  { id: 'quiz', label: 'Chapter Check', subtitle: '5 quick multiple-choice questions.' },
  { id: 'cliffhanger', label: 'Cliffhanger Detector', subtitle: 'Is there one, and what kind?' },
  { id: 'pacing', label: 'Pacing Analysis', subtitle: 'Where it slows, where it races.' },
  { id: 'key_passage', label: 'Key Passage', subtitle: 'The line you should not miss.' },
]

interface ChapterFeatureSheetProps {
  visible: boolean
  kind: ChapterFeatureKind | null
  bookTitle: string
  author: string
  chapterTitle: string
  bookId?: string
  progress?: number
  onClose: () => void
}

export function ChapterFeatureSheet({
  visible,
  kind,
  bookTitle,
  author,
  chapterTitle,
  bookId,
  progress,
  onClose,
}: ChapterFeatureSheetProps) {
  const colors = useColors()
  const [proseResult, setProseResult] = useState<string | null>(null)
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const featureLabel = CHAPTER_FEATURES.find((f) => f.id === kind)?.label ?? 'Chapter'

  useEffect(() => {
    if (!visible || !kind) return
    setProseResult(null)
    setQuiz(null)
    setError(null)
    setLoading(true)
    ;(async () => {
      try {
        if (kind === 'quiz') {
          const questions = await getComprehensionQuiz({
            bookTitle,
            author,
            chapterTitle,
            bookId,
            progress,
          })
          setQuiz(questions)
        } else {
          const text = await getChapterFeature(kind, {
            bookTitle,
            author,
            chapterTitle,
            bookId,
            progress,
          })
          setProseResult(text)
        }
      } catch (e) {
        setError(friendlyAiError(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [visible, kind, bookTitle, author, chapterTitle, bookId, progress])

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      header={
        <View className="flex-row items-center justify-between px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
            <XIcon color={colors.textPrimary} size={20} />
          </Pressable>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}>
            {featureLabel}
          </Text>
          <View style={{ width: 36 }} />
        </View>
      }
    >
          {chapterTitle ? (
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
              {chapterTitle}
            </Text>
          ) : null}
          <ChapterFeatureContent
            loading={loading}
            error={error}
            kind={kind}
            quiz={quiz}
            proseResult={proseResult}
          />
    </SheetScaffold>
  )
}
