import {
  isoWeek,
  MONTH_NAMES,
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useStats,
  useStreak,
  useUpdateGoal,
} from '@foxing/client'
import type * as W from '@foxing/types'
import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { YearGoalCard } from '@/components/goals/year-goal-card'
import { StreakCard } from '@/components/goals/streak-card'
import { WeeklySummaryCard } from '@/components/goals/weekly-summary-card'
import { PeriodGoalCard } from '@/components/goals/period-goal-card'

// The reader's books goals for this year, month and ISO week (GET /goals, progress counted
// on the server the same way the web goals page shows it), their streak and the last
// seven days of reading. Saving a target patches the cached goals at once.

type Period = W.Goal['periodType']

function currentPeriods(now: Date) {
  return { year: now.getFullYear(), month: now.getMonth() + 1, week: isoWeek(now) }
}

function isCurrent(goal: W.Goal, period: Period, now: ReturnType<typeof currentPeriods>) {
  if (goal.type !== 'books' || goal.periodType !== period || goal.year !== now.year) return false
  if (period === 'month') return goal.month === now.month
  if (period === 'week') return goal.week === now.week
  return true
}

/** One period's goal: the target being typed, and save or remove against the server. */
function usePeriodGoal(goals: W.GoalWithProgress[] | undefined, period: Period, max: number) {
  const now = useMemo(() => currentPeriods(new Date()), [])
  const row = goals?.find((g) => isCurrent(g.goal, period, now)) ?? null
  const create = useCreateGoal()
  const update = useUpdateGoal()
  const remove = useDeleteGoal()
  const [draft, setDraft] = useState('')
  useEffect(() => setDraft(row ? String(row.goal.target) : ''), [row?.goal.target])

  const save = () => {
    const target = parseInt(draft, 10)
    if (!Number.isFinite(target) || target < 1 || target > max) return
    if (row) update.fire({ id: row.goal.id, target })
    else
      create.fire({
        type: 'books',
        target,
        periodType: period,
        year: now.year,
        ...(period === 'month' ? { month: now.month } : {}),
        ...(period === 'week' ? { week: now.week } : {}),
      })
  }
  return {
    row,
    draft,
    setDraft,
    save,
    remove: () => row && remove.fire({ id: row.goal.id }),
    saving: create.pending || update.pending,
    error: create.error ?? update.error ?? remove.error,
  }
}

export default function GoalsScreen() {
  const colors = useColors()
  const router = useRouter()
  const goals = useGoals()
  const streak = useStreak().data ?? null
  const stats = useStats().data
  const year = usePeriodGoal(goals.data, 'year', 200)
  const month = usePeriodGoal(goals.data, 'month', 50)
  const week = usePeriodGoal(goals.data, 'week', 14)

  // Where this year's pace lands: the finish rate so far, carried to the target.
  const projectedCompletion = useMemo(() => {
    const done = year.row?.progress ?? 0
    const target = year.row?.goal.target ?? 0
    if (!target || done === 0 || done >= target) return null
    const start = new Date(new Date().getFullYear(), 0, 1).getTime()
    const perDay = done / Math.max(1, (Date.now() - start) / 86_400_000)
    return new Date(Date.now() + ((target - done) / perDay) * 86_400_000).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }, [year.row])

  const last7 = (stats?.week ?? []).map((d) => ({
    date: new Date(d.day).toISOString().slice(0, 10),
    minutes: d.minutes,
  }))
  const max7 = Math.max(1, ...last7.map((d) => d.minutes))
  const error = year.error ?? month.error ?? week.error

  if (goals.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2" accessibilityRole="button" accessibilityLabel="Back">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary, marginLeft: 4 }}
        >
          Reading Goals
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        {error || goals.error ? (
          <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.error, marginBottom: 8 }} accessibilityRole="alert">
            {error ?? 'Could not load your goals.'}
          </Text>
        ) : null}

        <YearGoalCard
          year={new Date().getFullYear()}
          target={year.draft}
          setTarget={year.setDraft}
          save={year.save}
          saving={year.saving}
          goalsRow={year.row ? { target: year.row.goal.target } : null}
          progress={year.row ? Math.min(1, year.row.progress / year.row.goal.target) : 0}
          projectedCompletion={projectedCompletion}
          colors={colors}
        />

        <PeriodGoalCard
          title={`${MONTH_NAMES[new Date().getMonth()]} goal`}
          unitNoun="this month"
          target={month.draft}
          onChange={month.setDraft}
          row={month.row ? { target: month.row.goal.target } : null}
          finished={month.row?.progress ?? 0}
          saving={month.saving}
          onSave={month.save}
          onRemove={month.remove}
          max={50}
          colors={colors}
        />

        <PeriodGoalCard
          title="This week"
          unitNoun="this week"
          target={week.draft}
          onChange={week.setDraft}
          row={week.row ? { target: week.row.goal.target } : null}
          finished={week.row?.progress ?? 0}
          saving={week.saving}
          onSave={week.save}
          onRemove={week.remove}
          max={14}
          colors={colors}
        />

        <StreakCard streak={streak} colors={colors} />

        <WeeklySummaryCard last7={last7} max7={max7} colors={colors} />
      </ScrollView>
    </SafeAreaView>
  )
}
