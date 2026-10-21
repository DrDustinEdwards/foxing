import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  type Challenge,
  joinChallenge,
  listCommunityChallenges,
  listMyChallenges,
  seedCommunityChallenges,
} from '@/lib/challenges'
import { YearGoalCard } from '@/components/goals/year-goal-card'
import { StreakCard } from '@/components/goals/streak-card'
import { YourReadingSection } from '@/components/goals/your-reading-section'
import { WeeklySummaryCard } from '@/components/goals/weekly-summary-card'
import { CommunityChallengesSection } from '@/components/goals/community-challenges-section'
import { PeriodGoalCard } from '@/components/goals/period-goal-card'

// Single goal type now (per task.md Section 1f). Legacy rows with
// type='books_year' coexist; we read them but write the new key.
const GOAL_TYPE = 'books_per_year'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function isoWeekOf(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  )
  return { year: d.getUTCFullYear(), week }
}

function weekStartISO(year: number, week: number): string {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const start = new Date(simple)
  const dow = simple.getUTCDay()
  if (dow <= 4) start.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1)
  else start.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay())
  return start.toISOString()
}

function weekEndISO(year: number, week: number): string {
  const start = new Date(weekStartISO(year, week))
  start.setUTCDate(start.getUTCDate() + 7)
  return start.toISOString()
}

interface SessionRow {
  started_at: string
  ended_at: string | null
  pages_read: number | null
}

interface StreakRow {
  current_streak: number
  longest_streak: number
  streak_freeze_credits: number
  last_read_date: string | null
}

interface CoachData {
  // Reading patterns
  topWeekday: string | null
  avgSessionMin: number | null
  bestTimeBucket: 'morning' | 'afternoon' | 'evening' | 'night' | null
  // Vocabulary growth
  totalVocab: number
  topVocabBooks: Array<{ title: string; count: number }>
  // Reading level, finished books count is the proxy, real difficulty trend
  // requires structured ratings we don't extract yet.
  finishedBooks: number
}

const HEAT_DAYS = 30

export default function GoalsScreen() {
  const colors = useColors()
  const router = useRouter()
  const year = new Date().getFullYear()

  const [target, setTarget] = useState<string>('')
  const [goalsRow, setGoalsRow] = useState<{ target: number } | null>(null)
  const [monthlyTarget, setMonthlyTarget] = useState<string>('')
  const [monthlyRow, setMonthlyRow] = useState<{ target: number } | null>(null)
  const [monthlyFinished, setMonthlyFinished] = useState<number>(0)
  const [weeklyTarget, setWeeklyTarget] = useState<string>('')
  const [weeklyRow, setWeeklyRow] = useState<{ target: number } | null>(null)
  const [weeklyFinished, setWeeklyFinished] = useState<number>(0)
  const [savingMonthly, setSavingMonthly] = useState(false)
  const [savingWeekly, setSavingWeekly] = useState(false)
  // Community challenges live at the bottom of this screen now (task.md 2b).
  const [communityChallenges, setCommunityChallenges] = useState<Challenge[]>([])
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [streak, setStreak] = useState<StreakRow | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [yearBooks, setYearBooks] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [coach, setCoach] = useState<CoachData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setUserId(user.id)
    const since = new Date()
    since.setUTCDate(since.getUTCDate() - HEAT_DAYS)
    const yearStart = `${year}-01-01T00:00:00Z`

    const [goalsRes, streakRes, sessionsRes, finishedRes] = await Promise.all([
      // Accept either the new books_per_year key or the legacy books_year row.
      supabase
        .from('reading_goals')
        .select('type, target')
        .eq('user_id', user.id)
        .eq('year', year)
        .in('type', [GOAL_TYPE, 'books_year'])
        .order('type', { ascending: false }) // 'books_per_year' sorts after 'books_year'
        .limit(1),
      supabase
        .from('reading_streaks')
        .select('current_streak, longest_streak, streak_freeze_credits, last_read_date')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('reading_sessions')
        .select('started_at, ended_at, pages_read')
        .eq('user_id', user.id)
        .gte('started_at', since.toISOString())
        .order('started_at', { ascending: true }),
      supabase
        .from('user_books')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'finished')
        .gte('finished_at', yearStart),
    ])

    const goalRow = ((goalsRes.data ?? []) as Array<{ type: string; target: number }>)[0]
    if (goalRow) {
      setGoalsRow({ target: goalRow.target })
      setTarget(String(goalRow.target))
    }

    // Monthly + weekly period goals.
    const now = new Date()
    const currentMonth = now.getUTCMonth() + 1
    const { year: isoYear, week: isoWeek } = isoWeekOf(now)
    const monthStart = new Date(Date.UTC(year, currentMonth - 1, 1)).toISOString()
    const monthEnd = new Date(Date.UTC(year, currentMonth, 1)).toISOString()
    const weekStart = weekStartISO(isoYear, isoWeek)
    const weekEnd = weekEndISO(isoYear, isoWeek)
    const [monthlyGoalRes, weeklyGoalRes, monthFinishedRes, weekFinishedRes] =
      await Promise.all([
        supabase
          .from('reading_goals')
          .select('target')
          .eq('user_id', user.id)
          .eq('year', year)
          .eq('month', currentMonth)
          .eq('period_type', 'monthly')
          .maybeSingle(),
        supabase
          .from('reading_goals')
          .select('target')
          .eq('user_id', user.id)
          .eq('year', isoYear)
          .eq('week', isoWeek)
          .eq('period_type', 'weekly')
          .maybeSingle(),
        supabase
          .from('user_books')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'finished')
          .gte('finished_at', monthStart)
          .lt('finished_at', monthEnd),
        supabase
          .from('user_books')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'finished')
          .gte('finished_at', weekStart)
          .lt('finished_at', weekEnd),
      ])
    const monthlyData = monthlyGoalRes.data as { target: number } | null
    if (monthlyData) {
      setMonthlyRow(monthlyData)
      setMonthlyTarget(String(monthlyData.target))
    } else {
      setMonthlyRow(null)
      setMonthlyTarget('')
    }
    const weeklyData = weeklyGoalRes.data as { target: number } | null
    if (weeklyData) {
      setWeeklyRow(weeklyData)
      setWeeklyTarget(String(weeklyData.target))
    } else {
      setWeeklyRow(null)
      setWeeklyTarget('')
    }
    setMonthlyFinished(monthFinishedRes.count ?? 0)
    setWeeklyFinished(weekFinishedRes.count ?? 0)

    // Community challenges + which ones we've joined.
    try {
      await seedCommunityChallenges()
      const [myRows, commRows] = await Promise.all([
        listMyChallenges(user.id),
        listCommunityChallenges(),
      ])
      setCommunityChallenges(commRows)
      setJoinedIds(new Set(myRows.map((c) => c.id)))
    } catch (e) {
      console.warn('[goals] community challenges load failed:', e instanceof Error ? e.message : e)
    }
    setStreak((streakRes.data as StreakRow | null) ?? null)
    setSessions((sessionsRes.data as SessionRow[] | null) ?? [])
    setYearBooks(finishedRes.count ?? 0)

    // Coach analytics, fan out separately so any table miss leaves only
    // the matching coach field null instead of failing the page.
    try {
      const [allSessionsRes, vocabRes, finishedAllRes] = await Promise.all([
        supabase
          .from('reading_sessions')
          .select('started_at, ended_at')
          .eq('user_id', user.id)
          .limit(500),
        supabase
          .from('vocabulary')
          .select('book_id, book:books(title)')
          .eq('user_id', user.id),
        supabase
          .from('user_books')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'finished'),
      ])
      const allSessions = (allSessionsRes.data ?? []) as Array<{
        started_at: string
        ended_at: string | null
      }>
      // Top weekday, count sessions per day-of-week.
      const weekdayCounts = new Map<number, number>()
      for (const s of allSessions) {
        const d = new Date(s.started_at).getDay()
        weekdayCounts.set(d, (weekdayCounts.get(d) ?? 0) + 1)
      }
      const topWeekdayIdx =
        [...weekdayCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const topWeekday = topWeekdayIdx === null ? null : weekdayNames[topWeekdayIdx]
      // Average session minutes, only sessions with an end timestamp.
      const completed = allSessions.filter((s) => !!s.ended_at)
      const totalMin = completed.reduce(
        (acc, s) =>
          acc + (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 60_000,
        0,
      )
      const avgSessionMin = completed.length > 0 ? Math.round(totalMin / completed.length) : null
      // Best time bucket, coarse buckets by hour of start.
      const buckets = { morning: 0, afternoon: 0, evening: 0, night: 0 }
      for (const s of allSessions) {
        const h = new Date(s.started_at).getHours()
        if (h >= 5 && h < 12) buckets.morning += 1
        else if (h < 17) buckets.afternoon += 1
        else if (h < 22) buckets.evening += 1
        else buckets.night += 1
      }
      const best = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]?.[0] as
        | CoachData['bestTimeBucket']
        | undefined
      // Vocabulary growth, total + top 3 books by count.
      type V = {
        book_id: string | null
        book: { title: string | null } | Array<{ title: string | null }> | null
      }
      const vocabPerBook = new Map<string, { title: string; count: number }>()
      for (const r of (((vocabRes.data ?? []) as unknown) as V[])) {
        const id = r.book_id ?? '__unknown__'
        const b = Array.isArray(r.book) ? r.book[0] : r.book
        const title = b?.title ?? 'Unknown book'
        const cur = vocabPerBook.get(id) ?? { title, count: 0 }
        cur.count += 1
        vocabPerBook.set(id, cur)
      }
      const totalVocab = [...vocabPerBook.values()].reduce((a, b) => a + b.count, 0)
      const topVocabBooks = [...vocabPerBook.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
      setCoach({
        topWeekday,
        avgSessionMin,
        bestTimeBucket: best ?? null,
        totalVocab,
        topVocabBooks,
        finishedBooks: finishedAllRes.count ?? 0,
      })
    } catch (e) {
      console.warn('[goals] coach analytics failed:', e instanceof Error ? e.message : e)
    }
    setLoading(false)
  }, [year])

  useEffect(() => {
    load()
  }, [load])

  const save = useCallback(async () => {
    if (!userId) return
    const numericTarget = parseInt(target, 10)
    if (!Number.isFinite(numericTarget) || numericTarget < 1 || numericTarget > 200) return
    setSaving(true)
    const { error } = await supabase
      .from('reading_goals')
      .upsert(
        { user_id: userId, year, type: GOAL_TYPE, target: numericTarget },
        { onConflict: 'user_id,year,type' },
      )
    if (error) console.warn('[goals] save failed:', error.message)
    setGoalsRow({ target: numericTarget })
    setSaving(false)
  }, [target, userId, year])

  const saveMonthly = useCallback(async () => {
    if (!userId) return
    const n = parseInt(monthlyTarget, 10)
    if (!Number.isFinite(n) || n < 1 || n > 50) return
    setSavingMonthly(true)
    const now = new Date()
    const month = now.getUTCMonth() + 1
    const { error } = await supabase.from('reading_goals').upsert(
      {
        user_id: userId,
        year,
        month,
        period_type: 'monthly',
        type: 'books',
        target: n,
      },
      { onConflict: 'user_id,year,month,period_type' },
    )
    if (error) console.warn('[goals] monthly save:', error.message)
    setMonthlyRow({ target: n })
    setSavingMonthly(false)
  }, [monthlyTarget, userId, year])

  const removeMonthly = useCallback(async () => {
    if (!userId) return
    const now = new Date()
    const month = now.getUTCMonth() + 1
    await supabase
      .from('reading_goals')
      .delete()
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .eq('period_type', 'monthly')
    setMonthlyRow(null)
    setMonthlyTarget('')
  }, [userId, year])

  const saveWeekly = useCallback(async () => {
    if (!userId) return
    const n = parseInt(weeklyTarget, 10)
    if (!Number.isFinite(n) || n < 1 || n > 14) return
    setSavingWeekly(true)
    const { year: y, week } = isoWeekOf(new Date())
    const { error } = await supabase.from('reading_goals').upsert(
      {
        user_id: userId,
        year: y,
        week,
        period_type: 'weekly',
        type: 'books',
        target: n,
      },
      { onConflict: 'user_id,year,week,period_type' },
    )
    if (error) console.warn('[goals] weekly save:', error.message)
    setWeeklyRow({ target: n })
    setSavingWeekly(false)
  }, [weeklyTarget, userId])

  const [usingFreeze, setUsingFreeze] = useState(false)
  const [freezeError, setFreezeError] = useState<string | null>(null)
  const yesterdayISO = useMemo(() => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().slice(0, 10)
  }, [])
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const streakAtRisk =
    (streak?.streak_freeze_credits ?? 0) > 0 &&
    (streak?.current_streak ?? 0) > 0 &&
    streak?.last_read_date === yesterdayISO

  const useFreeze = useCallback(async () => {
    if (!userId || !streak) return
    setFreezeError(null)
    setUsingFreeze(true)
    const credits = streak.streak_freeze_credits ?? 0
    if (credits <= 0) {
      setFreezeError('No freeze credits available.')
      setUsingFreeze(false)
      return
    }
    const { error } = await supabase
      .from('reading_streaks')
      .update({
        streak_freeze_credits: credits - 1,
        last_read_date: todayISO,
      })
      .eq('user_id', userId)
    setUsingFreeze(false)
    if (error) {
      setFreezeError(error.message)
      return
    }
    setStreak({
      ...streak,
      streak_freeze_credits: credits - 1,
      last_read_date: todayISO,
    })
  }, [streak, todayISO, userId])

  const removeWeekly = useCallback(async () => {
    if (!userId) return
    const { year: y, week } = isoWeekOf(new Date())
    await supabase
      .from('reading_goals')
      .delete()
      .eq('user_id', userId)
      .eq('year', y)
      .eq('week', week)
      .eq('period_type', 'weekly')
    setWeeklyRow(null)
    setWeeklyTarget('')
  }, [userId])

  const joinCommunityChallenge = useCallback(
    async (c: Challenge) => {
      const ok = await joinChallenge(c.id)
      if (ok) setJoinedIds((s) => new Set(s).add(c.id))
    },
    [],
  )

  // Derived: progress + projected completion for the books-per-year goal.
  const { progress, projectedCompletion } = useMemo(() => {
    if (!goalsRow) return { progress: 0, projectedCompletion: null as string | null }
    const t = goalsRow.target
    const yearStart = new Date(`${year}-01-01T00:00:00Z`).getTime()
    const now = Date.now()
    const daysIntoYear = Math.max(1, Math.floor((now - yearStart) / 86_400_000) + 1)
    const ratio = Math.max(0, Math.min(1, yearBooks / t))

    let projected: string | null = null
    if (yearBooks > 0) {
      const perDay = yearBooks / daysIntoYear
      if (perDay > 0) {
        const remaining = Math.max(0, t - yearBooks)
        const daysToFinish = remaining / perDay
        const projectedTime = now + daysToFinish * 86_400_000
        projected = new Date(projectedTime).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      }
    }
    return { progress: ratio, projectedCompletion: projected }
  }, [goalsRow, year, yearBooks])

  // Per-day reading minutes for the last 30 days → for the heat map and the
  // weekly summary chart.
  const dailyMinutes = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sessions) {
      if (!s.ended_at) continue
      const key = s.started_at.slice(0, 10)
      const mins = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60_000
      m.set(key, (m.get(key) ?? 0) + mins)
    }
    return m
  }, [sessions])

  const last30 = useMemo(() => {
    const out: Array<{ date: string; minutes: number }> = []
    const today = new Date()
    for (let i = HEAT_DAYS - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setUTCDate(today.getUTCDate() - i)
      const key = d.toISOString().slice(0, 10)
      out.push({ date: key, minutes: dailyMinutes.get(key) ?? 0 })
    }
    return out
  }, [dailyMinutes])

  const last7 = last30.slice(-7)
  const max7 = Math.max(1, ...last7.map((d) => d.minutes))

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary, marginLeft: 4 }}
        >
          Reading Goals
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        <YearGoalCard
          year={year}
          target={target}
          setTarget={setTarget}
          save={save}
          saving={saving}
          goalsRow={goalsRow}
          progress={progress}
          projectedCompletion={projectedCompletion}
          colors={colors}
        />

        <PeriodGoalCard
          title={`${MONTH_NAMES[new Date().getUTCMonth()]} goal`}
          unitNoun="this month"
          target={monthlyTarget}
          onChange={setMonthlyTarget}
          row={monthlyRow}
          finished={monthlyFinished}
          saving={savingMonthly}
          onSave={saveMonthly}
          onRemove={removeMonthly}
          max={50}
          colors={colors}
        />

        <PeriodGoalCard
          title="This week"
          unitNoun="this week"
          target={weeklyTarget}
          onChange={setWeeklyTarget}
          row={weeklyRow}
          finished={weeklyFinished}
          saving={savingWeekly}
          onSave={saveWeekly}
          onRemove={removeWeekly}
          max={14}
          colors={colors}
        />

        <StreakCard
          streak={streak}
          streakAtRisk={streakAtRisk}
          useFreeze={useFreeze}
          usingFreeze={usingFreeze}
          freezeError={freezeError}
          last30={last30}
          colors={colors}
        />

        {/* Your Reading, patterns, vocabulary growth, books finished. */}
        {coach ? (
          <YourReadingSection coach={coach} colors={colors} />
        ) : null}

        {/* Weekly summary */}
        <WeeklySummaryCard last7={last7} max7={max7} colors={colors} />

        {/* Community Challenges, merged in from the old challenges screen
            per task.md Section 2b. Personal challenges (create/edit) are
            deferred; this surface just lists + joins community ones. */}
        {communityChallenges.length > 0 ? (
          <CommunityChallengesSection
            communityChallenges={communityChallenges}
            joinedIds={joinedIds}
            joinCommunityChallenge={joinCommunityChallenge}
            colors={colors}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

