import { useDiary, useLibrary } from '@foxing/client'
import { useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, Star, StarHalf, BookOpen } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface Row {
  bookId: string
  slug: string
  title: string
  author: string
  coverUrl: string | null
  finishedAt: number | null
  /** Half stars, 1 to 10, from the reader's latest diary entry for the book. */
  ratingHalf: number | null
}

// Every finished book by the year it was finished: the library's finish dates with the
// rating from the reader's diary.
export default function ReadingTimelineScreen() {
  const colors = useColors()
  const router = useRouter()
  const library = useLibrary()
  const diary = useDiary()
  const loading = library.isPending
  const rows = useMemo<Row[]>(() => {
    const rating = new Map<string, number>()
    // The diary is newest first, so the first rating seen for a book is its latest.
    for (const d of diary.data ?? []) {
      if (d.ratingHalf && !rating.has(d.bookId)) rating.set(d.bookId, d.ratingHalf)
    }
    return (library.data ?? [])
      .filter((e) => e.status === 'finished')
      .map((e) => ({ ...e, ratingHalf: rating.get(e.bookId) ?? null }))
      .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
  }, [library.data, diary.data])

  // Group by the year each book was finished.
  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of rows) {
      const year = r.finishedAt ? new Date(r.finishedAt).getFullYear().toString() : 'Undated'
      const list = m.get(year) ?? []
      list.push(r)
      m.set(year, list)
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [rows])

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
          Reading Timeline
        </Text>
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <BookOpen color={colors.textTertiary} size={28} />
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textTertiary,
              textAlign: 'center',
              marginTop: 12,
            }}
          >
            You haven't finished a book yet. Your reading history will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {grouped.map(([year, entries]) => (
            <View key={year} style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontFamily: Fonts.displayBold,
                  fontSize: 16,
                  color: colors.textPrimary,
                  marginBottom: 8,
                }}
              >
                {year}
              </Text>
              {entries.map((e) => (
                <Pressable
                  key={e.bookId}
                  onPress={() => router.push(`/book/${e.slug}` as never)}
                  className="flex-row items-center p-2 mb-1 rounded-xl"
                >
                  <View
                    style={{
                      width: 28,
                      height: 42,
                      borderRadius: 4,
                      backgroundColor: colors.bgSunken,
                      overflow: 'hidden',
                      marginRight: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {e.coverUrl ? (
                      <Image source={{ uri: e.coverUrl }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <BookOpen color={colors.textTertiary} size={12} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}
                      numberOfLines={1}
                    >
                      {e.title}
                    </Text>
                    <Text
                      style={{
                        fontFamily: Fonts.ui,
                        fontSize: 11,
                        color: colors.textTertiary,
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {e.author}
                      {e.finishedAt
                        ? ` · ${new Date(e.finishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                        : ''}
                    </Text>
                  </View>
                  {e.ratingHalf ? (
                    <View
                      className="flex-row"
                      style={{ gap: 1 }}
                      accessible
                      accessibilityLabel={`Rated ${e.ratingHalf / 2} of 5`}
                    >
                      {[1, 2, 3, 4, 5].map((n) =>
                        n * 2 - 1 === e.ratingHalf ? (
                          <StarHalf key={n} color={colors.brandSecondary} size={10} weight="fill" />
                        ) : (
                          <Star
                            key={n}
                            color={colors.brandSecondary}
                            size={10}
                            weight={n * 2 <= (e.ratingHalf ?? 0) ? 'fill' : 'regular'}
                          />
                        ),
                      )}
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
