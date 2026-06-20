import { View, Text, ActivityIndicator } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import type { ChapterFeatureKind, QuizQuestion } from '@/lib/claude'
import { QuizView } from './chapter-feature-quiz'

interface ChapterFeatureContentProps {
  loading: boolean
  error: string | null
  kind: ChapterFeatureKind | null
  quiz: QuizQuestion[] | null
  proseResult: string | null
}

export function ChapterFeatureContent({
  loading,
  error,
  kind,
  quiz,
  proseResult,
}: ChapterFeatureContentProps) {
  const colors = useColors()

  if (loading) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <ActivityIndicator color={colors.brandUi} />
      </View>
    )
  }
  if (error) {
    return (
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
    )
  }
  if (kind === 'quiz') {
    return <QuizView questions={quiz ?? []} />
  }
  return (
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
  )
}
