import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { CheckCircle, XCircle, ArrowRight } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import type { QuizQuestion } from '@/lib/claude'

export function QuizView({ questions }: { questions: QuizQuestion[] }) {
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
