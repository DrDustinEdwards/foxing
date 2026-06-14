import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  Share,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  X as XIcon,
  Share as ShareIcon,
  BookOpen,
  Flame,
  Highlighter,
  Sparkle,
  Books,
  Clock,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { Colors, useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface Stats {
  year: number
  totalBooks: number
  totalPages: number
  estimatedHours: number
  topGenre: string | null
  longestStreak: number
  heatDays: Array<{ date: string; minutes: number }>
  mostHighlightedBook: { title: string; author: string; count: number } | null
  personality: string | null
}

const SLIDE_COUNT = 7

// Pinned-dark experience: dark-scheme tokens regardless of the system scheme.
const C = Colors.dark

export default function YearInReadingScreen() {
  const colors = useColors()
  const router = useRouter()
  const params = useLocalSearchParams<{ year?: string }>()
  const year = params.year ? parseInt(params.year, 10) : new Date().getFullYear()

  const { width } = Dimensions.get('window')
  const [index, setIndex] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const data = await collectStats(year)
      if (mounted) {
        setStats(data)
        setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [year])

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x
      const i = Math.round(x / width)
      if (i !== index) setIndex(i)
    },
    [index, width],
  )

  const share = useCallback(async () => {
    if (!stats) return
    const summary = `My ${year} on Foxing: ${stats.totalBooks} books, ${stats.totalPages.toLocaleString()} pages, ${stats.longestStreak}-day longest streak.`
    try {
      await Share.share({ message: summary })
    } catch {
      /* user cancelled */
    }
  }, [stats, year])

  if (loading || !stats) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: C.bgBase }}>
        <ActivityIndicator color={C.brandUi} />
      </SafeAreaView>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bgBase }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 6 }}>
            <XIcon color={C.textPrimary} size={20} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
              <View
                key={i}
                style={{
                  width: 18,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: i === index ? C.brandUi : 'rgba(245,237,222,0.18)',
                }}
              />
            ))}
          </View>
          <Pressable onPress={share} hitSlop={10} style={{ padding: 6 }}>
            <ShareIcon color={C.textPrimary} size={20} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          pagingEnabled
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {/* Slide 1, total books */}
          <Slide width={width}>
            <Text style={styles.kicker}>YOUR {year} IN READING</Text>
            <Text style={styles.heroNumber}>{stats.totalBooks}</Text>
            <Text style={styles.heroLabel}>
              book{stats.totalBooks === 1 ? '' : 's'} finished
            </Text>
          </Slide>

          {/* Slide 2, pages + hours */}
          <Slide width={width}>
            <Text style={styles.kicker}>PAGES</Text>
            <Text style={styles.heroNumber}>{stats.totalPages.toLocaleString()}</Text>
            <Text style={styles.heroLabel}>pages read</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 6 }}>
              <Clock color={C.brandUi} size={16} />
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: C.textSecondary }}>
                about {stats.estimatedHours} hour{stats.estimatedHours === 1 ? '' : 's'}
              </Text>
            </View>
          </Slide>

          {/* Slide 3, top genre */}
          <Slide width={width}>
            <Text style={styles.kicker}>TOP GENRE</Text>
            {stats.topGenre ? (
              <Text style={styles.heroTitle}>{stats.topGenre}</Text>
            ) : (
              <Text style={styles.heroTitle}></Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 }}>
              <Books color={C.brandUi} size={16} />
              <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: C.textSecondary }}>
                {stats.topGenre
                  ? 'where you spent most of your reading'
                  : 'add subjects to your books to see your top genre'}
              </Text>
            </View>
          </Slide>

          {/* Slide 4, streak + heat map */}
          <Slide width={width}>
            <Text style={styles.kicker}>LONGEST STREAK</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={styles.heroNumber}>{stats.longestStreak}</Text>
              <Flame color={C.brandUi} size={28} weight="fill" />
            </View>
            <Text style={styles.heroLabel}>day{stats.longestStreak === 1 ? '' : 's'} in a row</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 24, justifyContent: 'center', maxWidth: 280 }}>
              {stats.heatDays.map((d) => {
                const filled = d.minutes > 0
                const intensity = Math.min(1, d.minutes / 30)
                return (
                  <View
                    key={d.date}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      backgroundColor: filled ? C.brandUi : 'rgba(245,237,222,0.10)',
                      opacity: filled ? 0.4 + intensity * 0.6 : 1,
                    }}
                  />
                )
              })}
            </View>
            <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: C.textTertiary, marginTop: 8 }}>
              Last 30 days
            </Text>
          </Slide>

          {/* Slide 5, most highlighted */}
          <Slide width={width}>
            <Text style={styles.kicker}>MOST HIGHLIGHTED</Text>
            {stats.mostHighlightedBook ? (
              <>
                <Text style={[styles.heroTitle, { fontSize: 22 }]} numberOfLines={3}>
                  {stats.mostHighlightedBook.title}
                </Text>
                <Text
                  style={{ fontFamily: Fonts.ui, fontSize: 14, color: C.textSecondary, marginTop: 6 }}
                  numberOfLines={1}
                >
                  {stats.mostHighlightedBook.author}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 16,
                    gap: 6,
                  }}
                >
                  <Highlighter color={C.brandUi} size={16} />
                  <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: C.textSecondary }}>
                    {stats.mostHighlightedBook.count} highlights
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.heroTitle}></Text>
            )}
          </Slide>

          {/* Slide 6, reading personality */}
          <Slide width={width}>
            <Text style={styles.kicker}>YOUR READING PERSONALITY</Text>
            {stats.personality ? (
              <Text
                style={{
                  fontFamily: Fonts.bodyItalic,
                  fontSize: 18,
                  lineHeight: 27,
                  color: C.textPrimary,
                  textAlign: 'center',
                  paddingHorizontal: 12,
                }}
                numberOfLines={8}
              >
                {stats.personality}
              </Text>
            ) : (
              <Text
                style={{
                  fontFamily: Fonts.body,
                  fontSize: 14,
                  color: C.textSecondary,
                  textAlign: 'center',
                  paddingHorizontal: 24,
                }}
              >
                Tap "Refresh" on your profile to generate a reading personality from your highlights.
              </Text>
            )}
          </Slide>

          {/* Slide 7, outro */}
          <Slide width={width}>
            <Sparkle color={C.brandUi} size={24} weight="regular" />
            <Text
              style={{
                fontFamily: Fonts.display,
                fontSize: 56,
                color: C.brandUi,
                letterSpacing: -1,
                marginTop: 16,
              }}
            >
              Foxing
            </Text>
            <Text
              style={{
                fontFamily: Fonts.bodyItalic,
                fontSize: 18,
                color: C.textPrimary,
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              reading, together.
            </Text>
            <Pressable
              onPress={share}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 22,
                paddingVertical: 12,
                borderRadius: 999,
                backgroundColor: C.brandUi,
                marginTop: 36,
              }}
            >
              <ShareIcon color={C.textOnBrand} size={16} weight="regular" />
              <Text style={{ fontFamily: Fonts.uiMedium, color: C.textOnBrand, fontSize: 14 }}>
                Share your {year}
              </Text>
            </Pressable>
          </Slide>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function Slide({
  width,
  children,
}: {
  width: number
  children: React.ReactNode
}) {
  return (
    <View
      style={{
        width,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
      }}
    >
      {children}
    </View>
  )
}

const styles = {
  kicker: {
    fontFamily: Fonts.uiMedium,
    fontSize: 11,
    color: C.textTertiary,
    letterSpacing: 1.4,
    marginBottom: 18,
  } as const,
  heroNumber: {
    fontFamily: Fonts.displayBold,
    fontSize: 96,
    color: C.textPrimary,
    lineHeight: 100,
  } as const,
  heroLabel: {
    fontFamily: Fonts.ui,
    fontSize: 16,
    color: C.textSecondary,
    marginTop: 4,
  } as const,
  heroTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 32,
    color: C.textPrimary,
    textAlign: 'center' as const,
    lineHeight: 38,
  } as const,
}

// ── Stats collection ─────────────────────────────────────────────────────

async function collectStats(year: number): Promise<Stats> {
  const yearStart = `${year}-01-01T00:00:00Z`
  const yearEnd = `${year + 1}-01-01T00:00:00Z`
  const heatStart = new Date()
  heatStart.setUTCDate(heatStart.getUTCDate() - 30)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      year,
      totalBooks: 0,
      totalPages: 0,
      estimatedHours: 0,
      topGenre: null,
      longestStreak: 0,
      heatDays: buildHeatDays(new Map()),
      mostHighlightedBook: null,
      personality: null,
    }
  }
  const uid = user.id

  const [finishedRes, sessionsRes, highlightsRes, streakRes, profileRes] = await Promise.all([
    supabase
      .from('user_books')
      .select('book:books(id, title, author, word_count, subjects)')
      .eq('user_id', uid)
      .eq('status', 'finished')
      .gte('finished_at', yearStart)
      .lt('finished_at', yearEnd),
    supabase
      .from('reading_sessions')
      .select('started_at, ended_at')
      .eq('user_id', uid)
      .gte('started_at', heatStart.toISOString()),
    supabase
      .from('highlights')
      .select('book_id, book:books(title, author)')
      .eq('user_id', uid)
      .gte('created_at', yearStart)
      .lt('created_at', yearEnd),
    supabase
      .from('reading_streaks')
      .select('longest_streak')
      .eq('user_id', uid)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('reading_personality')
      .eq('id', uid)
      .maybeSingle(),
  ])

  type FR = {
    book: { id: string; title: string; author: string; word_count: number | null; subjects: string[] | null }
      | Array<{ id: string; title: string; author: string; word_count: number | null; subjects: string[] | null }>
      | null
  }
  const finishedRows = (((finishedRes.data ?? []) as unknown) as FR[]).map((r) => {
    const b = Array.isArray(r.book) ? r.book[0] : r.book
    return b
  }).filter((b): b is NonNullable<typeof b> => !!b)

  const totalBooks = finishedRows.length
  const totalWords = finishedRows.reduce((acc, b) => acc + (b.word_count ?? 0), 0)
  // ~250 wpm; pages computed at 250 words per page → keep in sync with the
  // reader-time estimate on the book detail screen.
  const totalPages = Math.round(totalWords / 250)
  const estimatedHours = Math.round(totalWords / 250 / 60)

  // Top genre, tally root subjects across finished books.
  const genreCounts = new Map<string, number>()
  for (const b of finishedRows) {
    for (const s of b.subjects ?? []) {
      const root = (s || '').split(/[\u2014\u2013\-:]/)[0].trim()
      if (!root) continue
      genreCounts.set(root, (genreCounts.get(root) ?? 0) + 1)
    }
  }
  const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // Heat map, minutes per day for last 30 days.
  const dailyMinutes = new Map<string, number>()
  for (const s of (sessionsRes.data ?? []) as Array<{ started_at: string; ended_at: string | null }>) {
    if (!s.ended_at) continue
    const key = s.started_at.slice(0, 10)
    const mins = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60_000
    dailyMinutes.set(key, (dailyMinutes.get(key) ?? 0) + mins)
  }
  const heatDays = buildHeatDays(dailyMinutes)

  // Most highlighted book, count highlight rows per book_id.
  type HR = {
    book_id: string
    book: { title: string; author: string } | Array<{ title: string; author: string }> | null
  }
  const counts = new Map<string, { title: string; author: string; count: number }>()
  for (const r of (((highlightsRes.data ?? []) as unknown) as HR[])) {
    if (!r.book_id) continue
    const b = Array.isArray(r.book) ? r.book[0] : r.book
    const existing = counts.get(r.book_id)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(r.book_id, { title: b?.title ?? '', author: b?.author ?? '', count: 1 })
    }
  }
  const top = [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null

  const longestStreak = (streakRes.data as { longest_streak: number | null } | null)?.longest_streak ?? 0
  const personality = (profileRes.data as { reading_personality: string | null } | null)?.reading_personality ?? null

  return {
    year,
    totalBooks,
    totalPages,
    estimatedHours,
    topGenre,
    longestStreak,
    heatDays,
    mostHighlightedBook: top,
    personality,
  }
}

function buildHeatDays(byDate: Map<string, number>): Array<{ date: string; minutes: number }> {
  const out: Array<{ date: string; minutes: number }> = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    out.push({ date: key, minutes: byDate.get(key) ?? 0 })
  }
  return out
}
