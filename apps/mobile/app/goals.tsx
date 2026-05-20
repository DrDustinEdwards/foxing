import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, Flame, Snowflake, Trophy } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  type Challenge,
  CHALLENGE_TYPES,
  joinChallenge,
  listCommunityChallenges,
  listMyChallenges,
  seedCommunityChallenges,
} from '@/lib/challenges'

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
        {/* Goal card */}
        <Section title={`${year} goal`}>
          <View
            className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <Text
              style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textSecondary, marginBottom: 10 }}
            >
              I want to read
            </Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={target}
                onChangeText={(t) => setTarget(t.replace(/[^0-9]/g, '').slice(0, 3))}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="12"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Books per year goal"
                style={{
                  flex: 0,
                  width: 90,
                  fontFamily: Fonts.uiMedium,
                  fontSize: 22,
                  textAlign: 'center',
                  color: colors.textPrimary,
                  backgroundColor: colors.bgBase,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingVertical: 8,
                }}
              />
              <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textSecondary, flex: 1 }}>
                books in {year}
              </Text>
              <Pressable
                onPress={save}
                disabled={saving || !target}
                accessibilityRole="button"
                accessibilityLabel="Save goal"
                accessibilityState={{ disabled: saving || !target }}
                className="px-4 py-2 rounded-full"
                style={{
                  backgroundColor: target ? colors.brandUi : colors.bgDisabled,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color={colors.textOnBrand} size="small" />
                ) : (
                  <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand, fontSize: 13 }}>
                    Save
                  </Text>
                )}
              </Pressable>
            </View>

            {goalsRow ? (
              <View style={{ marginTop: 16 }}>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.bgSunken,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 6,
                      width: `${Math.round(progress * 100)}%`,
                      backgroundColor: colors.brandUi,
                    }}
                  />
                </View>
                <View className="flex-row items-center justify-between" style={{ marginTop: 6 }}>
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: colors.textTertiary }}>
                    {Math.round(progress * 100)}% complete
                  </Text>
                  {projectedCompletion ? (
                    <Text
                      style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}
                    >
                      Projected: {projectedCompletion}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </Section>

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

        {/* Streak card */}
        <Section title="Streak">
          <View
            className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <View className="flex-row items-center">
              <Flame color={colors.brandUi} size={42} weight="fill" />
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text
                  style={{ fontFamily: Fonts.displayBold, fontSize: 36, color: colors.textPrimary }}
                >
                  {streak?.current_streak ?? 0}
                </Text>
                <Text
                  style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: -4 }}
                >
                  day{(streak?.current_streak ?? 0) === 1 ? '' : 's'} in a row
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
                  {streak?.longest_streak ?? 0}
                </Text>
                <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>
                  longest
                </Text>
              </View>
            </View>

            <View className="flex-row items-center" style={{ marginTop: 12 }}>
              <Snowflake color={colors.info} size={14} />
              <Text
                style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textSecondary, marginLeft: 6 }}
              >
                {streak?.streak_freeze_credits ?? 0} streak protection
                {(streak?.streak_freeze_credits ?? 0) === 1 ? '' : 's'} available
              </Text>
            </View>

            {/* Heat map, 30 dots, last 30 days */}
            <View className="flex-row flex-wrap" style={{ marginTop: 14, gap: 4 }}>
              {last30.map((d) => {
                const intensity = Math.min(1, d.minutes / 30) // 30 min → max
                const filled = d.minutes > 0
                const bg = filled
                  ? colors.brandUi
                  : colors.bgSunken
                return (
                  <View
                    key={d.date}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      backgroundColor: bg,
                      opacity: filled ? 0.35 + intensity * 0.65 : 1,
                    }}
                  />
                )
              })}
            </View>
          </View>
        </Section>

        {/* Your Reading, patterns, vocabulary growth, books finished. */}
        {coach ? (
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
        ) : null}

        {/* Weekly summary */}
        <Section title="This week">
          <View
            className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <View
              className="flex-row items-end justify-between"
              style={{ height: 100, marginBottom: 6 }}
            >
              {last7.map((d) => {
                const ratio = d.minutes / max7
                return (
                  <View key={d.date} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ flex: 1, justifyContent: 'flex-end', width: '70%' }}>
                      <View
                        style={{
                          height: `${Math.max(2, Math.round(ratio * 100))}%`,
                          backgroundColor: d.minutes > 0 ? colors.brandUi : colors.bgSunken,
                          borderRadius: 4,
                        }}
                      />
                    </View>
                  </View>
                )
              })}
            </View>
            <View className="flex-row justify-between" style={{ marginTop: 2 }}>
              {last7.map((d) => {
                const dayLetter = new Date(d.date + 'T00:00:00Z').toLocaleDateString(undefined, {
                  weekday: 'narrow',
                })
                return (
                  <Text
                    key={d.date}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontFamily: Fonts.ui,
                      fontSize: 10,
                      color: colors.textTertiary,
                    }}
                  >
                    {dayLetter}
                  </Text>
                )
              })}
            </View>
          </View>
        </Section>

        {/* Community Challenges, merged in from the old challenges screen
            per task.md Section 2b. Personal challenges (create/edit) are
            deferred; this surface just lists + joins community ones. */}
        {communityChallenges.length > 0 ? (
          <Section title="Community challenges">
            {communityChallenges.map((c) => {
              const unit = CHALLENGE_TYPES.find((t) => t.id === c.type)?.unit ?? ''
              const joined = joinedIds.has(c.id)
              return (
                <View
                  key={c.id}
                  className="p-4 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <View className="flex-row items-center" style={{ marginBottom: 6, gap: 8 }}>
                    <Trophy color={colors.brandUi} size={16} weight="regular" />
                    <Text
                      style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary, flex: 1 }}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                    {joined ? (
                      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.success }}>
                        Joined
                      </Text>
                    ) : (
                      <Pressable
                        onPress={() => joinCommunityChallenge(c)}
                        accessibilityRole="button"
                        accessibilityLabel={`Join ${c.name}`}
                        className="px-3 py-1 rounded-full"
                        style={{ backgroundColor: colors.brandUi }}
                      >
                        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textOnBrand }}>
                          Join
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  {c.description ? (
                    <Text
                      style={{
                        fontFamily: Fonts.body,
                        fontSize: 13,
                        color: colors.textSecondary,
                        marginBottom: 6,
                      }}
                    >
                      {c.description}
                    </Text>
                  ) : null}
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.textTertiary }}>
                    Target: {c.target} {unit}
                    {c.deadline ? ` · by ${new Date(c.deadline).toLocaleDateString()}` : ''}
                  </Text>
                </View>
              )
            })}
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function CoachLine({
  label,
  value,
  colors,
}: {
  label: string
  value: string
  colors: ReturnType<typeof useColors>
}) {
  return (
    <View className="flex-row items-baseline" style={{ marginBottom: 4 }}>
      <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, flex: 1 }}>
        {label}
      </Text>
      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
        {value}
      </Text>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 10,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  )
}

interface PeriodGoalCardProps {
  title: string
  unitNoun: string
  target: string
  onChange: (next: string) => void
  row: { target: number } | null
  finished: number
  saving: boolean
  onSave: () => Promise<void>
  onRemove: () => Promise<void>
  max: number
  colors: ReturnType<typeof useColors>
}

function PeriodGoalCard({
  title,
  unitNoun,
  target,
  onChange,
  row,
  finished,
  saving,
  onSave,
  onRemove,
  max,
  colors,
}: PeriodGoalCardProps) {
  const ratio = row ? Math.max(0, Math.min(1, finished / row.target)) : 0
  return (
    <Section title={title}>
      <View
        className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        <View className="flex-row items-center gap-2">
          <TextInput
            value={target}
            onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
            placeholder={String(Math.min(max, 4))}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={`${title} target`}
            style={{
              width: 72,
              fontFamily: Fonts.uiMedium,
              fontSize: 20,
              textAlign: 'center',
              color: colors.textPrimary,
              backgroundColor: colors.bgBase,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 10,
              paddingVertical: 8,
            }}
          />
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textSecondary,
              flex: 1,
            }}
          >
            books {unitNoun}
          </Text>
          <Pressable
            onPress={onSave}
            disabled={saving || !target}
            accessibilityRole="button"
            accessibilityLabel="Save"
            className="px-4 py-2 rounded-full"
            style={{
              backgroundColor: target ? colors.brandUi : colors.bgDisabled,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                color: colors.textOnBrand,
                fontSize: 13,
              }}
            >
              Save
            </Text>
          </Pressable>
        </View>
        {row ? (
          <View style={{ marginTop: 14 }}>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.bgSunken,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: 6,
                  width: `${Math.round(ratio * 100)}%`,
                  backgroundColor: colors.brandUi,
                }}
              />
            </View>
            <View
              className="flex-row items-center justify-between"
              style={{ marginTop: 6 }}
            >
              <Text
                style={{
                  fontFamily: Fonts.mono,
                  fontSize: 12,
                  color: colors.textTertiary,
                }}
              >
                {finished} of {row.target} books
              </Text>
              <Pressable onPress={onRemove}>
                <Text
                  style={{
                    fontFamily: Fonts.ui,
                    fontSize: 11,
                    color: colors.textTertiary,
                  }}
                >
                  Remove goal
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Section>
  )
}
