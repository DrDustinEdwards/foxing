import { View, Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { Section } from './section'
import { CoachLine } from './coach-line'

interface CoachData {
  topWeekday: string | null
  avgSessionMin: number | null
  bestTimeBucket: 'morning' | 'afternoon' | 'evening' | 'night' | null
  totalVocab: number
  topVocabBooks: Array<{ title: string; count: number }>
  finishedBooks: number
}

export function YourReadingSection({
  coach,
  colors,
}: {
  coach: CoachData
  colors: ReturnType<typeof useColors>
}) {
  return (
    <Section title="Your Reading">
      <View style={{ gap: 12 }}>
        {/* Patterns */}
        <View
          className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 13,
              color: colors.textPrimary,
              marginBottom: 8,
            }}
          >
            Reading patterns
          </Text>
          {coach.topWeekday ? (
            <CoachLine label="You read most on" value={coach.topWeekday} colors={colors} />
          ) : null}
          {coach.avgSessionMin !== null ? (
            <CoachLine
              label="Average session"
              value={`${coach.avgSessionMin} min`}
              colors={colors}
            />
          ) : null}
          {coach.bestTimeBucket ? (
            <CoachLine
              label="Best reading time"
              value={
                coach.bestTimeBucket.charAt(0).toUpperCase() +
                coach.bestTimeBucket.slice(1)
              }
              colors={colors}
            />
          ) : null}
          {!coach.topWeekday && coach.avgSessionMin === null && !coach.bestTimeBucket ? (
            <Text
              style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary }}
            >
              Read a few more sessions to unlock pattern insights.
            </Text>
          ) : null}
        </View>

        {/* Vocabulary growth */}
        <View
          className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 13,
              color: colors.textPrimary,
              marginBottom: 8,
            }}
          >
            Vocabulary growth
          </Text>
          <Text
            style={{
              fontFamily: Fonts.displayBold,
              fontSize: 28,
              color: colors.textPrimary,
              marginBottom: 2,
            }}
          >
            {coach.totalVocab}
          </Text>
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 12,
              color: colors.textTertiary,
              marginBottom: 12,
            }}
          >
            new words learned
          </Text>
          {coach.topVocabBooks.length > 0 ? (
            <View style={{ gap: 6 }}>
              {(() => {
                const max = Math.max(1, ...coach.topVocabBooks.map((b) => b.count))
                return coach.topVocabBooks.map((b) => (
                  <View key={b.title}>
                    <View className="flex-row items-center justify-between" style={{ marginBottom: 3 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          fontFamily: Fonts.ui,
                          fontSize: 12,
                          color: colors.textSecondary,
                        }}
                      >
                        {b.title}
                      </Text>
                      <Text
                        style={{
                          fontFamily: Fonts.mono,
                          fontSize: 11,
                          color: colors.textTertiary,
                          marginLeft: 8,
                        }}
                      >
                        {b.count}
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: colors.bgSunken,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          height: 4,
                          width: `${Math.round((b.count / max) * 100)}%`,
                          backgroundColor: colors.brandUi,
                        }}
                      />
                    </View>
                  </View>
                ))
              })()}
            </View>
          ) : null}
        </View>

        {/* Reading level progression, finished count as a proxy */}
        <View
          className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 13,
              color: colors.textPrimary,
              marginBottom: 8,
            }}
          >
            Reading level
          </Text>
          <Text
            style={{
              fontFamily: Fonts.displayBold,
              fontSize: 28,
              color: colors.textPrimary,
              marginBottom: 2,
            }}
          >
            {coach.finishedBooks}
          </Text>
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 12,
              color: colors.textTertiary,
              marginBottom: 8,
            }}
          >
            book{coach.finishedBooks === 1 ? '' : 's'} finished
          </Text>
          <Text
            style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textSecondary }}
          >
            {coach.finishedBooks === 0
              ? 'Finish your first book to start tracking your reading level.'
              : coach.finishedBooks < 5
              ? 'You’re building a foundation, keep going to unlock difficulty trends.'
              : 'Your library is growing. Try a slightly harder title next to push your level.'}
          </Text>
        </View>
      </View>
    </Section>
  )
}
