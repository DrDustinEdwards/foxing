import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft, BookOpen, CheckCircle, Bookmark, Clock } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  authorSlug,
  getAuthorBio,
  getReadingOrder,
  type ReadingOrderItem,
} from '@/lib/book-ai'

interface BookRow {
  id: string
  title: string
  author: string
  cover_url: string | null
  series_name: string | null
  series_order: number | null
}

interface UserBookRow {
  book_id: string
  status: 'reading' | 'want_to_read' | 'finished' | 'abandoned'
}

export default function AuthorScreen() {
  const colors = useColors()
  const router = useRouter()
  const { slug } = useLocalSearchParams<{ slug: string }>()

  const [authorName, setAuthorName] = useState<string | null>(null)
  const [books, setBooks] = useState<BookRow[]>([])
  const [userBooks, setUserBooks] = useState<Map<string, UserBookRow['status']>>(new Map())
  const [bio, setBio] = useState<string | null>(null)
  const [bioBusy, setBioBusy] = useState(false)
  const [order, setOrder] = useState<ReadingOrderItem[]>([])
  const [orderBusy, setOrderBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true)

    // Slugs come from authorSlug(name), lowercase + dashes. We have no
    // dedicated authors table, so we resolve by scanning candidate names
    // from the books table. Pull a generous slice and slug-match.
    const { data: candidateRows } = await supabase
      .from('books')
      .select('author')
      .limit(2000)
    const seen = new Set<string>()
    let matched: string | null = null
    for (const r of ((candidateRows ?? []) as Array<{ author: string }>)) {
      if (!r.author || seen.has(r.author)) continue
      seen.add(r.author)
      if (authorSlug(r.author) === slug) {
        matched = r.author
        break
      }
    }
    if (!matched) {
      setAuthorName(null)
      setLoading(false)
      return
    }
    setAuthorName(matched)

    const [worksRes, viewerRes] = await Promise.all([
      supabase
        .from('books')
        .select('id, title, author, cover_url, series_name, series_order')
        .eq('author', matched)
        .order('series_order', { ascending: true, nullsFirst: false }),
      supabase.auth.getUser(),
    ])
    const rows = ((worksRes.data ?? []) as BookRow[])
    setBooks(rows)

    const viewer = viewerRes.data.user
    if (viewer && rows.length > 0) {
      const { data: ub } = await supabase
        .from('user_books')
        .select('book_id, status')
        .eq('user_id', viewer.id)
        .in('book_id', rows.map((b) => b.id))
      const m = new Map<string, UserBookRow['status']>()
      for (const u of (ub ?? []) as UserBookRow[]) m.set(u.book_id, u.status)
      setUserBooks(m)
    }

    setLoading(false)
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  // Lazy-load bio after we know the author name.
  useEffect(() => {
    if (!authorName || bio) return
    setBioBusy(true)
    getAuthorBio(authorName)
      .then(setBio)
      .catch(() => setBio(null))
      .finally(() => setBioBusy(false))
  }, [authorName, bio])

  // Has-series detection, only request a reading-order plan if at least
  // one book carries series metadata. Otherwise the plan adds little.
  const hasSeries = useMemo(() => books.some((b) => !!b.series_name), [books])

  useEffect(() => {
    if (!authorName || !hasSeries || order.length > 0 || books.length < 2) return
    setOrderBusy(true)
    getReadingOrder(authorName, books.map((b) => b.title))
      .then(setOrder)
      .catch(() => setOrder([]))
      .finally(() => setOrderBusy(false))
  }, [authorName, books, hasSeries, order.length])

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }
  if (!authorName) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8 bg-bg-base-light dark:bg-bg-base-dark">
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textTertiary, textAlign: 'center' }}
        >
          We couldn't find that author in your catalog.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-3">
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 28,
            color: colors.textPrimary,
            marginBottom: 4,
          }}
        >
          {authorName}
        </Text>
        <Text
          style={{
            fontFamily: Fonts.ui,
            fontSize: 12,
            color: colors.textTertiary,
            marginBottom: 16,
          }}
        >
          {books.length} {books.length === 1 ? 'work' : 'works'} in catalog
        </Text>

        {/* Bio */}
        <SectionHeading>About</SectionHeading>
        {bioBusy && !bio ? (
          <View style={{ paddingVertical: 12 }}>
            <ActivityIndicator color={colors.brandUi} />
          </View>
        ) : (
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 15,
              color: colors.textPrimary,
              lineHeight: 23,
            }}
          >
            {bio ?? 'Biography not available.'}
          </Text>
        )}

        {/* Reading order plan */}
        {hasSeries ? (
          <>
            <SectionHeading>Suggested reading order</SectionHeading>
            {orderBusy && order.length === 0 ? (
              <View style={{ paddingVertical: 12 }}>
                <ActivityIndicator color={colors.brandUi} />
              </View>
            ) : order.length === 0 ? (
              <Text
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 12,
                  color: colors.textTertiary,
                }}
              >
                Couldn't suggest an order right now.
              </Text>
            ) : (
              <View
                className="p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              >
                {order.map((it, i) => (
                  <View
                    key={`${i}:${it.title}`}
                    className="flex-row"
                    style={{
                      paddingVertical: 8,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.borderSubtle,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.mono,
                        fontSize: 13,
                        color: colors.brandText,
                        width: 28,
                      }}
                    >
                      {i + 1}.
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: Fonts.uiMedium,
                          fontSize: 14,
                          color: colors.textPrimary,
                        }}
                      >
                        {it.title}
                      </Text>
                      {it.note ? (
                        <Text
                          style={{
                            fontFamily: Fonts.ui,
                            fontSize: 12,
                            color: colors.textTertiary,
                            marginTop: 2,
                          }}
                        >
                          {it.note}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}

        {/* Works grid */}
        <SectionHeading>Works in Foxing</SectionHeading>
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {books.map((b) => {
            const status = userBooks.get(b.id)
            return (
              <Pressable
                key={b.id}
                onPress={() => router.push(`/book/${b.id}` as never)}
                style={{ width: '47%' }}
              >
                <View
                  style={{
                    aspectRatio: 2 / 3,
                    borderRadius: 6,
                    overflow: 'hidden',
                    backgroundColor: colors.bgSunken,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 6,
                  }}
                >
                  {b.cover_url ? (
                    <Image
                      source={{ uri: b.cover_url }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <BookOpen color={colors.textTertiary} size={22} />
                  )}
                  {status ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: colors.brandUi,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <StatusIcon status={status} />
                    </View>
                  ) : null}
                </View>
                <Text
                  style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}
                  numberOfLines={2}
                >
                  {b.title}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatusIcon({ status }: { status: UserBookRow['status'] }) {
  if (status === 'finished') return <CheckCircle color="#fff" size={12} weight="fill" />
  if (status === 'reading') return <Clock color="#fff" size={12} weight="regular" />
  return <Bookmark color="#fff" size={12} weight="regular" />
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <Text
      style={{
        fontFamily: Fonts.uiMedium,
        fontSize: 11,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginTop: 18,
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  )
}
