import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

interface UserStats {
  booksFinishedYear: number
  booksFinishedAllTime: number
  avgRating: number | null
  currentStreak: number
  topGenre: string | null
  topMood: string | null
  mostReadAuthor: string | null
  finishedBookIds: Set<string>
}

interface BookSummary {
  id: string
  title: string
  author: string
  cover_url: string | null
}

interface CompareResult {
  viewer: { profile: Profile; stats: UserStats }
  other: { profile: Profile; stats: UserStats }
  shared_books: BookSummary[]
  shared_count: number
  taste_percent: number
}

function topOf(values: string[]): string | null {
  if (values.length === 0) return null
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', userId)
    .maybeSingle()
  return (data as Profile | null) ?? null
}

async function loadStats(userId: string): Promise<UserStats> {
  const year = new Date().getUTCFullYear()
  const yearStart = `${year}-01-01T00:00:00Z`
  const [finishedRes, finishedYearRes, streakRes] = await Promise.all([
    supabase
      .from('user_books')
      .select(
        'book_id, rating_half, mood_tags, books:book_id(author, themes)',
      )
      .eq('user_id', userId)
      .eq('status', 'finished'),
    supabase
      .from('user_books')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'finished')
      .gte('finished_at', yearStart),
    supabase
      .from('reading_streaks')
      .select('current_streak')
      .eq('user_id', userId)
      .maybeSingle(),
  ])
  type Row = {
    book_id: string
    rating_half: number | null
    mood_tags: string[] | null
    books:
      | { author: string | null; themes: string[] | null }
      | Array<{ author: string | null; themes: string[] | null }>
      | null
  }
  const rows = (finishedRes.data ?? []) as Row[]
  const themes: string[] = []
  const moods: string[] = []
  const authors: string[] = []
  const ratings: number[] = []
  const bookIds = new Set<string>()
  for (const r of rows) {
    bookIds.add(r.book_id)
    if (typeof r.rating_half === 'number') ratings.push(r.rating_half)
    if (r.mood_tags) moods.push(...r.mood_tags)
    const b = Array.isArray(r.books) ? r.books[0] : r.books
    if (b?.author) authors.push(b.author)
    if (b?.themes) themes.push(...b.themes)
  }
  const avg =
    ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length / 2
      : null
  const streak =
    (streakRes.data as { current_streak: number | null } | null)?.current_streak ?? 0
  return {
    booksFinishedYear: finishedYearRes.count ?? 0,
    booksFinishedAllTime: bookIds.size,
    avgRating: avg,
    currentStreak: streak,
    topGenre: topOf(themes),
    topMood: topOf(moods),
    mostReadAuthor: topOf(authors),
    finishedBookIds: bookIds,
  }
}

async function loadCompare(
  viewerId: string,
  otherId: string,
): Promise<CompareResult | null> {
  const [viewerProfile, otherProfile, viewerStats, otherStats] = await Promise.all([
    loadProfile(viewerId),
    loadProfile(otherId),
    loadStats(viewerId),
    loadStats(otherId),
  ])
  if (!viewerProfile || !otherProfile) return null
  const shared: string[] = []
  for (const id of viewerStats.finishedBookIds) {
    if (otherStats.finishedBookIds.has(id)) shared.push(id)
  }
  const total =
    viewerStats.finishedBookIds.size + otherStats.finishedBookIds.size - shared.length
  const percent = total > 0 ? Math.round((shared.length / total) * 100) : 0
  let sharedBooks: BookSummary[] = []
  if (shared.length > 0) {
    const { data } = await supabase
      .from('books')
      .select('id, title, author, cover_url')
      .in('id', shared.slice(0, 5))
    sharedBooks = ((data ?? []) as BookSummary[]) ?? []
  }
  return {
    viewer: { profile: viewerProfile, stats: viewerStats },
    other: { profile: otherProfile, stats: otherStats },
    shared_books: sharedBooks,
    shared_count: shared.length,
    taste_percent: percent,
  }
}

export default function CompareScreen() {
  const colors = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [result, setResult] = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/(auth)/login' as never)
      return
    }
    if (user.id === id) {
      router.back()
      return
    }
    setLoading(true)
    const r = await loadCompare(user.id, id)
    setResult(r)
    setLoading(false)
  }, [id, router])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }

  if (!result) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark px-8">
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 14,
            color: colors.textTertiary,
            textAlign: 'center',
          }}
        >
          Could not compare with this reader.
        </Text>
      </SafeAreaView>
    )
  }

  const { viewer, other, shared_books, shared_count, taste_percent } = result

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 18,
            color: colors.textPrimary,
            marginLeft: 4,
          }}
        >
          Compare
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Text
          style={{
            fontFamily: Fonts.display,
            fontSize: 22,
            color: colors.textPrimary,
            marginBottom: 4,
          }}
        >
          {viewer.profile.display_name} vs {other.profile.display_name}
        </Text>
        <View
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: colors.brandSubtle,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 12,
              color: colors.brandSubtleText,
            }}
          >
            {shared_count === 0
              ? 'No book overlap yet'
              : `${taste_percent}% taste match`}
          </Text>
        </View>

        <StatRow
          label="Books finished this year"
          a={viewer.stats.booksFinishedYear}
          b={other.stats.booksFinishedYear}
          colors={colors}
        />
        <StatRow
          label="Books finished all time"
          a={viewer.stats.booksFinishedAllTime}
          b={other.stats.booksFinishedAllTime}
          colors={colors}
        />
        <StatRow
          label="Average rating"
          a={viewer.stats.avgRating ? `${viewer.stats.avgRating.toFixed(1)}/5` : '-'}
          b={other.stats.avgRating ? `${other.stats.avgRating.toFixed(1)}/5` : '-'}
          colors={colors}
        />
        <StatRow
          label="Current streak"
          a={`${viewer.stats.currentStreak}d`}
          b={`${other.stats.currentStreak}d`}
          colors={colors}
        />
        <StatRow
          label="Top genre"
          a={viewer.stats.topGenre ?? '-'}
          b={other.stats.topGenre ?? '-'}
          colors={colors}
        />
        <StatRow
          label="Top mood"
          a={viewer.stats.topMood ?? '-'}
          b={other.stats.topMood ?? '-'}
          colors={colors}
        />
        <StatRow
          label="Most read author"
          a={viewer.stats.mostReadAuthor ?? '-'}
          b={other.stats.mostReadAuthor ?? '-'}
          colors={colors}
        />

        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginTop: 24,
            marginBottom: 10,
          }}
        >
          Books in common ({shared_count})
        </Text>
        {shared_books.length === 0 ? (
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 13,
              color: colors.textTertiary,
            }}
          >
            No finished books in common yet.
          </Text>
        ) : (
          <View className="flex-row" style={{ gap: 8 }}>
            {shared_books.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => router.push(`/book/${b.id}` as never)}
                style={{ width: 70 }}
              >
                <View
                  style={{
                    width: 70,
                    height: 105,
                    borderRadius: 6,
                    overflow: 'hidden',
                    backgroundColor: colors.bgSunken,
                  }}
                >
                  {b.cover_url ? (
                    <Image
                      source={{ uri: b.cover_url }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : null}
                </View>
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 11,
                    color: colors.textPrimary,
                    marginTop: 4,
                  }}
                  numberOfLines={2}
                >
                  {b.title}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatRow({
  label,
  a,
  b,
  colors,
}: {
  label: string
  a: string | number
  b: string | number
  colors: ReturnType<typeof useColors>
}) {
  return (
    <View
      className="flex-row items-center py-3 border-b border-border-subtle-light dark:border-border-subtle-dark"
    >
      <Text
        style={{
          flex: 1,
          fontFamily: Fonts.ui,
          fontSize: 12,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          flex: 1,
          textAlign: 'right',
          fontFamily: Fonts.uiMedium,
          fontSize: 14,
          color: colors.textPrimary,
        }}
        numberOfLines={1}
      >
        {a}
      </Text>
      <Text
        style={{
          width: 24,
          textAlign: 'center',
          fontFamily: Fonts.ui,
          fontSize: 12,
          color: colors.textTertiary,
        }}
      >
        vs
      </Text>
      <Text
        style={{
          flex: 1,
          textAlign: 'left',
          fontFamily: Fonts.uiMedium,
          fontSize: 14,
          color: colors.textPrimary,
        }}
        numberOfLines={1}
      >
        {b}
      </Text>
    </View>
  )
}
