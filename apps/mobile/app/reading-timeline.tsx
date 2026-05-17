import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { CaretLeft, Star, BookOpen } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface Row {
  id: string
  finished_at: string | null
  rating: number | null
  book: { id: string; title: string; author: string; cover_url: string | null } | null
}

export default function ReadingTimelineScreen() {
  const colors = useColors()
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setRows([])
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('user_books')
      .select('id, finished_at, rating, book:books(id, title, author, cover_url)')
      .eq('user_id', user.id)
      .eq('status', 'finished')
      .order('finished_at', { ascending: false })
    type R = {
      id: string
      finished_at: string | null
      rating: number | null
      book: { id: string; title: string; author: string; cover_url: string | null }
        | Array<{ id: string; title: string; author: string; cover_url: string | null }>
        | null
    }
    setRows(
      (((data ?? []) as unknown) as R[]).map((r) => ({
        id: r.id,
        finished_at: r.finished_at,
        rating: r.rating,
        book: Array.isArray(r.book) ? r.book[0] ?? null : r.book,
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Group by year of finished_at.
  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of rows) {
      const year = r.finished_at ? new Date(r.finished_at).getFullYear().toString() : 'Undated'
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
                  key={e.id}
                  onPress={() => e.book && router.push(`/book/${e.book.id}` as never)}
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
                    {e.book?.cover_url ? (
                      <Image source={{ uri: e.book.cover_url }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <BookOpen color={colors.textTertiary} size={12} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}
                      numberOfLines={1}
                    >
                      {e.book?.title ?? ''}
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
                      {e.book?.author ?? ''}
                      {e.finished_at
                        ? ` · ${new Date(e.finished_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                        : ''}
                    </Text>
                  </View>
                  {e.rating ? (
                    <View className="flex-row" style={{ gap: 1 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          color={colors.brandSecondary}
                          size={10}
                          weight={n <= (e.rating ?? 0) ? 'fill' : 'regular'}
                        />
                      ))}
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
