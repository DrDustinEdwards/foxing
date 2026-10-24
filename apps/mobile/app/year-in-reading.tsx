import { MONTH_NAMES, useCompanion, useMyAnnotations, useRecap, useStreak } from '@foxing/client'
import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  Share,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native'
import { Screen } from '@/components/ui/screen'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  X as XIcon,
  Share as ShareIcon,
  Flame,
  Highlighter,
  Sparkle,
  Books,
  Clock,
} from 'phosphor-react-native'
import { Colors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface Stats {
  year: number
  totalBooks: number
  totalPages: number
  estimatedHours: number
  topGenre: string | null
  longestStreak: number
  monthly: number[]
  mostHighlightedBook: { title: string; author: string; count: number } | null
  /** The book the companion reads the year through for the personality slide. */
  anchorBookId: string | null
}

// Same reading-speed assumption as the reader's time estimates: 250 words a page,
// 250 words a minute.
const WORDS_PER_PAGE = 250
const WORDS_PER_MINUTE = 250

const SLIDE_COUNT = 7

// Pinned-dark experience: dark-scheme tokens regardless of the system scheme.
const C = Colors.dark

export default function YearInReadingScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ year?: string }>()
  const year = params.year ? parseInt(params.year, 10) : new Date().getFullYear()

  const { width } = Dimensions.get('window')
  const [index, setIndex] = useState(0)
  const recap = useRecap(year)
  const streak = useStreak().data
  const highlights = useMyAnnotations(['highlight']).data
  const personality = useCompanion()
  const loading = recap.isPending

  // GET /recap/:year (the same numbers as the web Year in Reading page), the all-time
  // longest streak, and the year's highlights counted per book.
  const stats = useMemo<Stats | null>(() => {
    if (!recap.data) return null
    const { recap: r, monthly, genres } = recap.data
    const counts = new Map<string, { title: string; author: string; count: number }>()
    for (const h of highlights ?? []) {
      if (!h.bookId || new Date(h.createdAt).getFullYear() !== year) continue
      const c = counts.get(h.bookId) ?? { title: h.bookTitle ?? '', author: h.bookAuthor ?? '', count: 0 }
      c.count += 1
      counts.set(h.bookId, c)
    }
    return {
      year,
      totalBooks: r.booksFinished,
      totalPages: Math.round(r.totalWords / WORDS_PER_PAGE),
      estimatedHours: Math.round(r.totalWords / WORDS_PER_MINUTE / 60),
      topGenre: genres[0]?.name ?? null,
      longestStreak: streak?.longestStreak ?? 0,
      monthly,
      mostHighlightedBook: [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null,
      anchorBookId: r.topBooks[0]?.bookId ?? r.finished.at(-1)?.bookId ?? null,
    }
  }, [recap.data, highlights, streak, year])

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
      <Screen className="items-center justify-center" style={{ backgroundColor: C.bgBase }}>
        <ActivityIndicator color={C.brandUi} />
      </Screen>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bgBase }}>
      <Screen style={{ flex: 1 }}>
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
            <View
              style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 24, height: 72 }}
              accessible
              accessibilityLabel={`Books finished each month: ${stats.monthly.map((n, i) => `${MONTH_NAMES[i]} ${n}`).join(', ')}`}
            >
              {stats.monthly.map((n, i) => (
                <View key={MONTH_NAMES[i]} style={{ alignItems: 'center', gap: 4 }}>
                  <View
                    style={{
                      width: 14,
                      height: Math.max(4, (n / Math.max(1, ...stats.monthly)) * 56),
                      borderRadius: 3,
                      backgroundColor: n > 0 ? C.brandUi : 'rgba(245,237,222,0.10)',
                    }}
                  />
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 9, color: C.textTertiary }}>
                    {MONTH_NAMES[i][0]}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: C.textTertiary, marginTop: 8 }}>
              Books finished each month
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
            {personality.text ? (
              <Text
                style={{
                  fontFamily: Fonts.bodyItalic,
                  fontSize: 18,
                  lineHeight: 27,
                  color: C.textPrimary,
                  textAlign: 'center',
                  paddingHorizontal: 12,
                }}
                numberOfLines={10}
              >
                {personality.text}
              </Text>
            ) : stats.anchorBookId ? (
              <Pressable
                onPress={() => {
                  if (stats.anchorBookId) void personality.run({ action: 'reading_personality', bookId: stats.anchorBookId })
                }}
                disabled={personality.pending}
                accessibilityRole="button"
                style={{
                  marginTop: 8,
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: C.brandUi,
                  opacity: personality.pending ? 0.7 : 1,
                }}
              >
                <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: C.textOnBrand }}>
                  {personality.pending ? 'Reading your year…' : 'Write my reading personality'}
                </Text>
              </Pressable>
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
                Finish a book this year and the companion can describe your reading.
              </Text>
            )}
            {personality.error ? (
              <Text
                style={{ fontFamily: Fonts.ui, fontSize: 12, color: C.textSecondary, marginTop: 10, textAlign: 'center' }}
                accessibilityRole="alert"
              >
                {personality.planRequired ? 'The reading personality is part of Foxing Plus.' : personality.error}
              </Text>
            ) : null}
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
      </Screen>
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
