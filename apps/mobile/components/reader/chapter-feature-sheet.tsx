import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { X as XIcon, CheckCircle, XCircle, ArrowRight } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  friendlyAiError,
  getChapterFeature,
  getComprehensionQuiz,
  type ChapterFeatureKind,
  type QuizQuestion,
} from '@/lib/claude'

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
          {loading ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator color={colors.brandUi} />
            </View>
          ) : error ? (
            <View
              style={{
                padding: 12,
                borderRadius: 10,
                backgroundColor: colors.errorBg,
              }}
            >
              <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.error }}>
                {error}
              </Text>
            </View>
          ) : kind === 'quiz' ? (
            <QuizView questions={quiz ?? []} />
          ) : (
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 15,
                color: colors.textPrimary,
                lineHeight: 23,
              }}
            >
              {proseResult ?? ''}
            </Text>
          )}
    </SheetScaffold>
  )
}

// ── Quiz view ────────────────────────────────────────────────────────────

function QuizView({ questions }: { questions: QuizQuestion[] }) {
  const colors = useColors()
  const [picks, setPicks] = useState<Record<number, number>>({})
  const [revealed, setRevealed] = useState(false)

  if (questions.length === 0) {
    return (
      <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>
        Couldn't generate a quiz for this chapter.
      </Text>
    )
  }
  const answered = Object.keys(picks).length
  const score = revealed
    ? Object.entries(picks).filter(([i, choice]) => questions[Number(i)].correctIndex === choice).length
    : 0

  return (
    <View>
      {questions.map((q, i) => (
        <View
          key={i}
          className="mb-4 p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 14,
              color: colors.textPrimary,
              marginBottom: 10,
            }}
          >
            {i + 1}. {q.q}
          </Text>
          {q.choices.map((c, ci) => {
            const picked = picks[i] === ci
            const isCorrect = ci === q.correctIndex
            const showCorrect = revealed && isCorrect
            const showWrong = revealed && picked && !isCorrect
            return (
              <Pressable
                key={ci}
                onPress={() => {
                  if (revealed) return
                  setPicks((p) => ({ ...p, [i]: ci }))
                }}
                className="flex-row items-center p-2 mb-1 rounded-lg border"
                style={{
                  borderColor: showCorrect
                    ? colors.successBorder
                    : showWrong
                      ? colors.errorBorder
                      : picked
                        ? colors.borderBrand
                        : colors.borderSubtle,
                  backgroundColor: showCorrect
                    ? colors.successBg
                    : showWrong
                      ? colors.errorBg
                      : picked
                        ? colors.bgSelected
                        : 'transparent',
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontFamily: Fonts.body,
                    fontSize: 13,
                    color: showCorrect
                      ? colors.success
                      : showWrong
                        ? colors.error
                        : colors.textPrimary,
                  }}
                >
                  {String.fromCharCode(65 + ci)}. {c}
                </Text>
                {showCorrect ? (
                  <CheckCircle color={colors.success} size={14} weight="fill" />
                ) : showWrong ? (
                  <XCircle color={colors.error} size={14} weight="fill" />
                ) : null}
              </Pressable>
            )
          })}
          {revealed && q.why ? (
            <Text
              style={{
                fontFamily: Fonts.bodyItalic,
                fontSize: 12,
                color: colors.textSecondary,
                marginTop: 4,
                lineHeight: 17,
              }}
            >
              {q.why}
            </Text>
          ) : null}
        </View>
      ))}
      {!revealed ? (
        <Pressable
          onPress={() => setRevealed(true)}
          disabled={answered < questions.length}
          className="flex-row items-center justify-center gap-2 py-3 rounded-full"
          style={{
            backgroundColor: answered === questions.length ? colors.brandUi : colors.bgDisabled,
          }}
        >
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textOnBrand }}>
            Reveal answers
          </Text>
          <ArrowRight color={colors.textOnBrand} size={14} weight="bold" />
        </Pressable>
      ) : (
        <View
          style={{
            alignItems: 'center',
            padding: 16,
            borderRadius: 14,
            backgroundColor: colors.brandSubtle,
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.displayBold,
              fontSize: 28,
              color: colors.brandSubtleText,
            }}
          >
            {score} / {questions.length}
          </Text>
          <Text
            style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.brandSubtleText, marginTop: 4 }}
          >
            {score === questions.length
              ? 'Perfect.'
              : score >= questions.length / 2
                ? 'Solid.'
                : 'Worth re-reading the chapter.'}
          </Text>
        </View>
      )}
    </View>
  )
}
