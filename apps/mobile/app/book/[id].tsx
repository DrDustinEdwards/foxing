import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Share,
  Modal,
  Alert,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  CaretLeft,
  ShareNetwork,
  Star,
  BookOpen,
  ImageSquare,
  Link as LinkIcon,
  Megaphone,
  CaretRight,
  CaretDown,
  Heart,
  BookmarkSimple,
  UserPlus,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  authorSlug,
  getBookDescription,
  getBookInsight,
  getDeepDive,
  getSimilarBooks,
  type BookInsightLens,
  type DeepDiveKind,
  type SimilarBook,
} from '@/lib/book-ai'
import { haptic } from '@/lib/haptics'
import { FinishReviewSheet } from '@/components/book/finish-review-sheet'
import { ChapterReactionsSection } from '@/components/book/chapter-reactions-section'
import { BookDiscussionsSection } from '@/components/book/book-discussions-section'
import { PassageCommentsSection } from '@/components/book/passage-comments-section'

interface BookRow {
  id: string
  title: string
  author: string
  cover_url: string | null
  description: string | null
  subjects: string[] | null
  word_count: number | null
  series_name?: string | null
  series_order?: number | null
  mood_tags?: string[] | null
  pacing?: 'slow' | 'medium' | 'fast' | null
  content_warnings?: string[] | null
}

interface UserBookRow {
  id: string
  status: 'reading' | 'paused' | 'want_to_read' | 'finished' | 'abandoned'
  progress_percentage: number
  is_favorite: boolean | null
}

interface ReviewRow {
  rating: number | null
  review: string | null
  user: {
    id: string
    display_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

interface ClubLite {
  id: string
  name: string
  member_count: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function pacingLabel(p: 'slow' | 'medium' | 'fast' | string | null | undefined): string {
  if (p === 'slow') return 'Slow-paced'
  if (p === 'fast') return 'Fast-paced'
  if (p === 'medium') return 'Medium-paced'
  return ''
}

export default function BookDetail() {
  const colors = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [book, setBook] = useState<BookRow | null>(null)
  const [userBook, setUserBook] = useState<UserBookRow | null>(null)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const [recommendOpen, setRecommendOpen] = useState(false)
  // Pause-note modal, captures the optional "why are you pausing?" note
  // when the user picks Pause from the status menu.
  const [pauseModalOpen, setPauseModalOpen] = useState(false)
  const [pauseNote, setPauseNote] = useState('')
  // Finish review sheet, opens immediately after a fresh transition to
  // 'finished'. The celebration flow (quote card + series prompt) runs after
  // the sheet closes so we don't stack two routes on top of each other.
  const [finishReviewUserBookId, setFinishReviewUserBookId] = useState<string | null>(null)
  const finishCelebrationRef = useRef<(() => void) | null>(null)

  // AI
  const [description, setDescription] = useState<string | null>(null)
  const [descLoading, setDescLoading] = useState(false)
  const [descError, setDescError] = useState<string | null>(null)
  const [insights, setInsights] = useState<Partial<Record<BookInsightLens, string | 'loading' | 'error'>>>({})
  const [deepDive, setDeepDive] = useState<Partial<Record<DeepDiveKind, string | 'loading' | 'error'>>>({})
  const [similar, setSimilar] = useState<SimilarBook[]>([])

  // Community
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [readerCount, setReaderCount] = useState(0)
  const [recentReviews, setRecentReviews] = useState<ReviewRow[]>([])

  // More by author
  const [moreByAuthor, setMoreByAuthor] = useState<BookRow[]>([])

  // Clubs reading this
  const [clubs, setClubs] = useState<ClubLite[]>([])

  // Public highlights for this book, pulled from highlights.is_public=true.
  const [popularHighlights, setPopularHighlights] = useState<
    Array<{ id: string; text: string; user: { display_name: string | null; username: string | null } | null }>
  >([])

  // Collapsibles, About/Deep Dive default closed per task.md Section 1.
  // Content warnings also default closed so they don't dominate the page.
  const [showDescription, setShowDescription] = useState(false)
  const [showDeepDive, setShowDeepDive] = useState(false)
  const [showContentWarnings, setShowContentWarnings] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setViewerId(user?.id ?? null)

    // Accept either a uuid or a legacy Gutenberg numeric id.
    const isUuid = UUID_RE.test(id)
    let bookRow: BookRow | null = null
    if (isUuid) {
      const { data } = await supabase
        .from('books')
        .select('id, title, author, cover_url, description, subjects, word_count, series_name, series_order, mood_tags, pacing, content_warnings')
        .eq('id', id)
        .maybeSingle()
      bookRow = (data as BookRow | null) ?? null
    } else {
      const numeric = Number(id)
      if (Number.isFinite(numeric)) {
        const { data } = await supabase
          .from('books')
          .select('id, title, author, cover_url, description, subjects, word_count, series_name, series_order, mood_tags, pacing, content_warnings')
          .eq('gutenberg_id', numeric)
          .maybeSingle()
        bookRow = (data as BookRow | null) ?? null
      }
    }
    if (!bookRow) {
      setBook(null)
      setLoading(false)
      return
    }
    setBook(bookRow)
    setDescription(bookRow.description ?? null)

    if (user) {
      const { data: ub } = await supabase
        .from('user_books')
        .select('id, status, progress_percentage, is_favorite')
        .eq('user_id', user.id)
        .eq('book_id', bookRow.id)
        .maybeSingle()
      setUserBook((ub as UserBookRow | null) ?? null)
    }

    // Community stats, average rating + reader count.
    const { data: ratings } = await supabase
      .from('user_books')
      .select('rating')
      .eq('book_id', bookRow.id)
      .not('rating', 'is', null)
    const nums = (ratings ?? []).map((r) => (r as { rating: number }).rating)
    setAvgRating(nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null)
    const { count: rc } = await supabase
      .from('user_books')
      .select('id', { count: 'exact', head: true })
      .eq('book_id', bookRow.id)
    setReaderCount(rc ?? 0)

    // Recent public reviews.
    const { data: reviews } = await supabase
      .from('user_books')
      .select(
        'rating, review, user:profiles!user_id(id, display_name, username, avatar_url)',
      )
      .eq('book_id', bookRow.id)
      .eq('review_is_public', true)
      .not('review', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3)
    setRecentReviews(((reviews ?? []) as unknown) as ReviewRow[])

    // More by this author.
    const { data: more } = await supabase
      .from('books')
      .select('id, title, author, cover_url, description, subjects, word_count, series_name')
      .eq('author', bookRow.author)
      .neq('id', bookRow.id)
      .limit(4)
    setMoreByAuthor(((more ?? []) as BookRow[]))

    // Clubs reading this book.
    const { data: clubRows } = await supabase
      .from('clubs')
      .select('id, name, member_count')
      .eq('current_book_id', bookRow.id)
      .eq('is_public', true)
      .limit(3)
    setClubs(((clubRows ?? []) as ClubLite[]))

    // Popular highlights, public passages from other readers for this book.
    const { data: hlRows } = await supabase
      .from('highlights')
      .select('id, text, user:profiles!user_id(display_name, username)')
      .eq('book_id', bookRow.id)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(3)
    type HR = {
      id: string
      text: string
      user:
        | { display_name: string | null; username: string | null }
        | Array<{ display_name: string | null; username: string | null }>
        | null
    }
    setPopularHighlights(
      (((hlRows ?? []) as unknown) as HR[]).map((r) => ({
        id: r.id,
        text: r.text,
        user: Array.isArray(r.user) ? r.user[0] ?? null : r.user,
      })),
    )

    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Fetch AI description in the background if we don't have it cached.
  useEffect(() => {
    if (!book || description) return
    setDescLoading(true)
    getBookDescription({ bookId: book.id, bookTitle: book.title, author: book.author })
      .then((d) => setDescription(d))
      .catch((e) => setDescError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setDescLoading(false))
  }, [book, description])

  // ── Mutations ────────────────────────────────────────────────────────────

  const setStatus = useCallback(
    async (status: UserBookRow['status']) => {
      if (!book || !viewerId) return
      const wasFinished = userBook?.status === 'finished'
      const payload: Record<string, unknown> = {
        user_id: viewerId,
        book_id: book.id,
        status,
      }
      if (status === 'reading') payload.started_at = new Date().toISOString()
      if (status === 'finished') payload.finished_at = new Date().toISOString()
      const { data, error } = await supabase
        .from('user_books')
        .upsert(payload, { onConflict: 'user_id,book_id' })
        .select('id, status, progress_percentage, is_favorite')
        .single()
      if (!error && data) setUserBook(data as UserBookRow)
      setStatusMenuOpen(false)
      // Fresh transition to finished, surface the review sheet first, then
      // run the celebration (quote-card nav + series follow-up) once the
      // sheet closes. We capture all the celebration data up front and
      // stash it in a ref so the post-close handler can replay it.
      if (status === 'finished' && !wasFinished && data) {
        haptic.success()
        ;(async () => {
          const { notifyClubMembersOfFinish } = await import('@/lib/clubs')
          await notifyClubMembersOfFinish({
            finisherUserId: viewerId,
            bookId: book.id,
            bookTitle: book.title,
          })
        })().catch(() => {})
        const startIso = (data as { started_at?: string } | null)?.started_at
        let daysToRead: number | null = null
        if (startIso) {
          const ms = Date.now() - new Date(startIso).getTime()
          daysToRead = Math.max(1, Math.round(ms / 86_400_000))
        }
        const { count: highlightCount } = await supabase
          .from('highlights')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', viewerId)
          .eq('book_id', book.id)

        finishCelebrationRef.current = () => {
          router.push({
            pathname: '/quote-card',
            params: {
              type: 'finished',
              bookId: book.id,
              bookTitle: book.title,
              author: book.author,
              coverUrl: book.cover_url ?? '',
              daysToRead: daysToRead != null ? String(daysToRead) : '',
              highlightCount: String(highlightCount ?? 0),
            },
          } as never)
          if (book.series_name) {
            let q = supabase
              .from('books')
              .select('id, title, author, cover_url, series_order')
              .eq('series_name', book.series_name)
              .neq('id', book.id)
              .order('series_order', { ascending: true, nullsFirst: false })
              .limit(1)
            if (typeof book.series_order === 'number') {
              q = q.gt('series_order', book.series_order)
            }
            q.then(({ data: nextRow }) => {
              const next = ((nextRow ?? [])[0] as
                | { id: string; title: string; author: string }
                | undefined)
              if (!next) return
              setTimeout(() => {
                Alert.alert(
                  `Next in ${book.series_name}`,
                  `${next.title} is up next. Add it to your library?`,
                  [
                    { text: 'Maybe later', style: 'cancel' },
                    {
                      text: 'Add to Want to Read',
                      onPress: async () => {
                        await supabase.from('user_books').upsert(
                          { user_id: viewerId, book_id: next.id, status: 'want_to_read' },
                          { onConflict: 'user_id,book_id' },
                        )
                      },
                    },
                    {
                      text: 'Open',
                      onPress: () => router.push(`/book/${next.id}` as never),
                    },
                  ],
                )
              }, 600)
            })
          }
        }

        const userBookId = (data as { id: string }).id
        setFinishReviewUserBookId(userBookId)
      }
    },
    [book, router, userBook, viewerId],
  )

  const toggleFavorite = useCallback(async () => {
    if (!book || !viewerId) return
    const next = !userBook?.is_favorite
    setUserBook((prev) => (prev ? { ...prev, is_favorite: next } : prev))
    await supabase
      .from('user_books')
      .upsert(
        {
          user_id: viewerId,
          book_id: book.id,
          status: userBook?.status ?? 'want_to_read',
          is_favorite: next,
        },
        { onConflict: 'user_id,book_id' },
      )
  }, [book, userBook, viewerId])

  const fetchInsight = useCallback(
    async (lens: BookInsightLens) => {
      if (!book) return
      setInsights((m) => ({ ...m, [lens]: 'loading' }))
      try {
        const text = await getBookInsight(
          { bookId: book.id, bookTitle: book.title, author: book.author },
          lens,
        )
        setInsights((m) => ({ ...m, [lens]: text }))
      } catch {
        setInsights((m) => ({ ...m, [lens]: 'error' }))
      }
    },
    [book],
  )

  const fetchDeepDive = useCallback(
    async (kind: DeepDiveKind) => {
      if (!book) return
      setDeepDive((m) => ({ ...m, [kind]: 'loading' }))
      try {
        const text = await getDeepDive(
          { bookId: book.id, bookTitle: book.title, author: book.author },
          kind,
        )
        setDeepDive((m) => ({ ...m, [kind]: text }))
      } catch {
        setDeepDive((m) => ({ ...m, [kind]: 'error' }))
      }
    },
    [book],
  )

  const fetchSimilar = useCallback(async () => {
    if (!book || similar.length > 0) return
    try {
      const list = await getSimilarBooks({
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
      })
      setSimilar(list)
    } catch {
      // ignore
    }
  }, [book, similar.length])

  useEffect(() => {
    if (book) fetchSimilar()
  }, [book, fetchSimilar])

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }
  if (!book) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8 bg-bg-base-light dark:bg-bg-base-dark">
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textTertiary, textAlign: 'center' }}
        >
          We couldn't find that book.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-3">
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const readMinutes = book.word_count ? Math.round(book.word_count / 250) : null
  const readingTimeLabel = readMinutes
    ? readMinutes >= 60
      ? `~${Math.round(readMinutes / 60)} hr read`
      : `~${readMinutes} min read`
    : null

  const subjects = (book.subjects ?? []).slice(0, 8)

  return (
    <View className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Header with cover hero + gradient */}
        <View style={{ height: 320, backgroundColor: colors.bgSunken }}>
          {book.cover_url ? (
            <Image
              source={{ uri: book.cover_url }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              blurRadius={4}
            />
          ) : null}
          {/* Faux-gradient: solid translucent stripes at the bottom faking a fade.
              Avoids adding expo-linear-gradient as a native dep just for this. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 120,
              backgroundColor: colors.bgBase,
              opacity: 0.55,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 60,
              backgroundColor: colors.bgBase,
              opacity: 0.85,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 12,
              paddingTop: 48,
            }}
          >
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.scrimLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CaretLeft color={colors.textOnDark} size={18} />
            </Pressable>
            <Pressable
              onPress={() => setShareMenuOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Share book"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.scrimLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShareNetwork color={colors.textOnDark} size={18} />
            </Pressable>
          </View>
          {/* Cover thumbnail centered over the bottom of the hero */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -30,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 120,
                height: 180,
                borderRadius: 8,
                overflow: 'hidden',
                backgroundColor: colors.bgSurface,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
              }}
            >
              {book.cover_url ? (
                <Image
                  source={{ uri: book.cover_url }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  accessibilityRole="image"
                  accessibilityLabel={`${book.title} book cover`}
                />
              ) : (
                <View
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 }}
                >
                  <Text
                    style={{ fontFamily: Fonts.display, fontSize: 14, color: colors.textTertiary, textAlign: 'center' }}
                    numberOfLines={4}
                  >
                    {book.title}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={{ marginTop: 48, paddingHorizontal: 20 }}>
          <Text
            style={{
              fontFamily: Fonts.displayBold,
              fontSize: 22,
              color: colors.textPrimary,
              textAlign: 'center',
            }}
          >
            {book.title}
          </Text>
          <Pressable
            onPress={() =>
              router.push(`/author/${authorSlug(book.author)}` as never)
            }
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 14,
                color: colors.brandText,
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              {book.author}
            </Text>
          </Pressable>
          {book.series_name ? (
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 11,
                color: colors.textTertiary,
                textAlign: 'center',
                marginTop: 2,
              }}
            >
              {book.series_name}
            </Text>
          ) : null}
          {readingTimeLabel ? (
            <Text
              style={{
                fontFamily: Fonts.mono,
                fontSize: 11,
                color: colors.textTertiary,
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              {readingTimeLabel}
            </Text>
          ) : null}

          {subjects.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 12, gap: 6 }}
            >
              {subjects.map((s) => (
                <View
                  key={s}
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: colors.brandSubtle }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 11,
                      color: colors.brandSubtleText,
                    }}
                    numberOfLines={1}
                  >
                    {s.split(/[\u2014\u2013\-:]/)[0].trim().slice(0, 40)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          {/* Primary CTA */}
          <PrimaryCta
            userBook={userBook}
            onAddPress={() => setStatusMenuOpen(true)}
            onContinue={() => book && router.push(`/reader/${book.id}` as never)}
            onReread={() => setStatus('reading')}
          />

          {/* Secondary row */}
          <View className="flex-row items-center justify-around mt-3 mb-2">
            <SecondaryButton
              Icon={Heart}
              label={userBook?.is_favorite ? 'Favorited' : 'Favorite'}
              onPress={toggleFavorite}
              active={!!userBook?.is_favorite}
            />
            <SecondaryButton
              Icon={BookmarkSimple}
              label="Want"
              onPress={() => setStatus('want_to_read')}
              active={userBook?.status === 'want_to_read'}
            />
            <SecondaryButton
              Icon={ShareNetwork}
              label="Share"
              onPress={() => setShareMenuOpen(true)}
            />
          </View>
        </View>

        {/* Community, rating + mood + pacing. Surfaced ABOVE Where to Read
            and the AI sections per task.md Section 1 so the social signal
            leads. */}
        <SectionHeading>Community</SectionHeading>
        <View style={{ paddingHorizontal: 20 }}>
          <View className="flex-row items-center" style={{ marginBottom: 12 }}>
            <Star color={colors.brandSecondary} size={18} weight="fill" />
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 15,
                color: colors.textPrimary,
                marginLeft: 6,
              }}
            >
              {avgRating ? avgRating.toFixed(1) : ''}
            </Text>
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 12,
                color: colors.textTertiary,
                marginLeft: 10,
              }}
            >
              from {readerCount} reader{readerCount === 1 ? '' : 's'}
            </Text>
          </View>
          {book.mood_tags && book.mood_tags.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
              style={{ marginBottom: 8 }}
            >
              {book.mood_tags.map((m) => (
                <View
                  key={m}
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: colors.brandSubtle }}
                >
                  <Text
                    style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandSubtleText }}
                    numberOfLines={1}
                  >
                    {m}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : null}
          {book.pacing ? (
            <Text
              style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textSecondary }}
            >
              Most readers say:{' '}
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary }}>
                {pacingLabel(book.pacing)}
              </Text>
            </Text>
          ) : null}
        </View>

        {/* Content warnings, collapsed by default so they don't dominate. */}
        {book.content_warnings && book.content_warnings.length > 0 ? (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <Pressable
              onPress={() => setShowContentWarnings((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={
                showContentWarnings ? 'Hide content warnings' : 'Show content warnings'
              }
              accessibilityState={{ expanded: showContentWarnings }}
              className="flex-row items-center justify-between px-4 py-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text
                style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}
              >
                Content warnings
              </Text>
              {showContentWarnings ? (
                <CaretDown color={colors.textTertiary} size={14} />
              ) : (
                <CaretRight color={colors.textTertiary} size={14} />
              )}
            </Pressable>
            {showContentWarnings ? (
              <View
                className="mt-2 p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              >
                {book.content_warnings.map((w) => (
                  <Text
                    key={w}
                    style={{
                      fontFamily: Fonts.body,
                      fontSize: 13,
                      color: colors.textSecondary,
                      marginBottom: 4,
                    }}
                  >
                    • {w}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Where to Read, surfaced high up per task.md Section D so users
            see read/library/buy options before the AI cards. */}
        <SectionHeading>Where to read</SectionHeading>
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          {book.id ? (
            <Pressable
              onPress={() => router.push(`/reader/${book.id}` as never)}
              accessibilityRole="button"
              accessibilityLabel="Read this book in Foxing"
              className="px-4 py-3 rounded-xl items-center"
              style={{ backgroundColor: colors.brandUi }}
            >
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand, fontSize: 14 }}>
                Read free in Foxing
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() =>
              Share.share({
                message: `https://www.worldcat.org/search?q=${encodeURIComponent(`${book.title} ${book.author}`)}`,
              })
            }
            accessibilityRole="link"
            accessibilityLabel="Find in a library"
            className="px-4 py-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark items-center"
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary, fontSize: 14 }}>
              Find in a library
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              Share.share({
                message: `https://bookshop.org/search?keywords=${encodeURIComponent(book.title)}`,
              })
            }
            accessibilityRole="link"
            accessibilityLabel="Buy a copy on Bookshop.org"
            className="px-4 py-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark items-center"
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary, fontSize: 14 }}>
              Buy a copy
            </Text>
          </Pressable>
        </View>

        {/* About this book, collapsed by default per task.md Section 1.
            Lazy-loads the AI description on first expand. */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <Pressable
            onPress={() => setShowDescription((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={
              showDescription ? 'Hide about this book' : 'Show about this book'
            }
            accessibilityState={{ expanded: showDescription }}
            className="flex-row items-center justify-between px-4 py-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
              About this book
            </Text>
            {showDescription ? (
              <CaretDown color={colors.textTertiary} size={14} />
            ) : (
              <CaretRight color={colors.textTertiary} size={14} />
            )}
          </Pressable>
          {showDescription ? (
            <View style={{ marginTop: 8 }}>
              {descLoading && !description ? (
                <View style={{ paddingVertical: 16 }}>
                  <ActivityIndicator color={colors.brandUi} />
                </View>
              ) : descError && !description ? (
                <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>
                  Couldn't generate a description right now.
                </Text>
              ) : (
                <ExpandableText text={description ?? ''} />
              )}
            </View>
          ) : null}
        </View>

        {/* Deep Dive, bundles the AI insight lenses and the long-form
            analyses behind a single collapsible header per task.md Section 1.
            Default closed; the cards' own lazy-fetch fires on first expand. */}
        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <Pressable
            onPress={() => setShowDeepDive((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showDeepDive ? 'Hide Deep Dive' : 'Show Deep Dive'}
            accessibilityState={{ expanded: showDeepDive }}
            className="flex-row items-center justify-between px-4 py-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
              Deep Dive
            </Text>
            {showDeepDive ? (
              <CaretDown color={colors.textTertiary} size={14} />
            ) : (
              <CaretRight color={colors.textTertiary} size={14} />
            )}
          </Pressable>
        </View>

        {showDeepDive ? (
        <>
        {/* AI Insights */}
        <SectionHeading>AI insights</SectionHeading>
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          <InsightCard
            lens="difficulty"
            label="Reading difficulty"
            state={insights.difficulty}
            onOpen={() => fetchInsight('difficulty')}
          />
          <InsightCard
            lens="warnings"
            label="Content warnings"
            state={insights.warnings}
            onOpen={() => fetchInsight('warnings')}
          />
          <InsightCard
            lens="context"
            label="Historical context"
            state={insights.context}
            onOpen={() => fetchInsight('context')}
          />
          <InsightCard
            lens="appeal"
            label="Why readers love it"
            state={insights.appeal}
            onOpen={() => fetchInsight('appeal')}
          />
        </View>

        {/* Deep Dive, long-form analyses cached in book_ai_cache. The
            reread guide is gated on the viewer having finished the book. */}
        <SectionHeading>Deep Dive</SectionHeading>
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          <DeepDiveCard kind="book_summary" label="Full Book Summary" state={deepDive.book_summary} onOpen={() => fetchDeepDive('book_summary')} />
          <DeepDiveCard kind="character_arcs" label="Character Arc Tracker" state={deepDive.character_arcs} onOpen={() => fetchDeepDive('character_arcs')} />
          <DeepDiveCard kind="book_timeline" label="Chronological Timeline" state={deepDive.book_timeline} onOpen={() => fetchDeepDive('book_timeline')} />
          <DeepDiveCard kind="theme_analysis" label="Theme Analysis" state={deepDive.theme_analysis} onOpen={() => fetchDeepDive('theme_analysis')} />
          <DeepDiveCard kind="symbolism_index" label="Symbolism Index" state={deepDive.symbolism_index} onOpen={() => fetchDeepDive('symbolism_index')} />
          <DeepDiveCard kind="criticism_digest" label="Literary Criticism Digest" state={deepDive.criticism_digest} onOpen={() => fetchDeepDive('criticism_digest')} />
          <DeepDiveCard kind="influence_map" label="Influence Map" state={deepDive.influence_map} onOpen={() => fetchDeepDive('influence_map')} />
          <DeepDiveCard kind="narrative_structure" label="Narrative Structure" state={deepDive.narrative_structure} onOpen={() => fetchDeepDive('narrative_structure')} />
          <DeepDiveCard kind="pov_analysis" label="POV Analysis" state={deepDive.pov_analysis} onOpen={() => fetchDeepDive('pov_analysis')} />
          <DeepDiveCard kind="setting_analysis" label="Setting Analysis" state={deepDive.setting_analysis} onOpen={() => fetchDeepDive('setting_analysis')} />
          {userBook?.status === 'finished' ? (
            <DeepDiveCard kind="reread_guide" label="First vs Second Read" state={deepDive.reread_guide} onOpen={() => fetchDeepDive('reread_guide')} />
          ) : (
            <View
              className="flex-row items-center p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              style={{ opacity: 0.6 }}
            >
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary, flex: 1 }}>
                First vs Second Read
              </Text>
              <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>
                🔒 Finish the book first
              </Text>
            </View>
          )}
        </View>
        </>
        ) : null}

        {/* Reviews + Similar were previously bundled under Community. Per
            task.md Section 1 they're now distinct sections, reviews sits
            with the social signal, similar books lives further down. */}
        <SectionHeading>Recent reviews</SectionHeading>
        <View style={{ paddingHorizontal: 20 }}>
          {recentReviews.length === 0 ? (
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 12,
                color: colors.textTertiary,
                marginBottom: 12,
              }}
            >
              No public reviews yet.
            </Text>
          ) : (
            recentReviews.map((r, i) => (
              <View
                key={`${r.user?.id}:${i}`}
                className="p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              >
                <View className="flex-row items-center" style={{ marginBottom: 4 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 12,
                      color: colors.textPrimary,
                    }}
                  >
                    {r.user?.display_name ?? r.user?.username ?? 'Reader'}
                  </Text>
                  {r.rating ? (
                    <Text
                      style={{
                        fontFamily: Fonts.mono,
                        fontSize: 11,
                        color: colors.brandSecondary,
                        marginLeft: 8,
                      }}
                    >
                      {'★'.repeat(r.rating)}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 13,
                    color: colors.textSecondary,
                    lineHeight: 18,
                  }}
                  numberOfLines={4}
                >
                  {r.review}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Popular highlights, public passages from other readers. */}
        {popularHighlights.length > 0 ? (
          <>
            <SectionHeading>Popular highlights</SectionHeading>
            <View style={{ paddingHorizontal: 20, gap: 8 }}>
              {popularHighlights.map((h) => {
                const name = h.user?.display_name ?? h.user?.username ?? null
                return (
                  <View
                    key={h.id}
                    className="p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.bodyItalic,
                        fontSize: 14,
                        color: colors.textPrimary,
                        lineHeight: 21,
                      }}
                      numberOfLines={4}
                    >
                      "{h.text}"
                    </Text>
                    {name ? (
                      <Text
                        style={{
                          fontFamily: Fonts.ui,
                          fontSize: 11,
                          color: colors.textTertiary,
                          marginTop: 6,
                        }}
                      >
                       , {name}
                      </Text>
                    ) : null}
                  </View>
                )
              })}
            </View>
          </>
        ) : null}

        {/* Similar books, extracted from the old Community block per
            task.md Section 1. */}
        {similar.length > 0 ? (
          <>
            <SectionHeading>Readers also liked</SectionHeading>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingRight: 12 }}
            >
              {similar.map((s) => (
                <Pressable
                  key={`${s.title}:${s.author}`}
                  onPress={() => s.bookId && router.push(`/book/${s.bookId}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.title} by ${s.author}`}
                  className="p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                  style={{ width: 220 }}
                >
                  <Text
                    style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}
                    numberOfLines={2}
                  >
                    {s.title}
                  </Text>
                  <Text
                    style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {s.author}
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.bodyItalic,
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 6,
                      lineHeight: 17,
                    }}
                    numberOfLines={3}
                  >
                    {s.reason}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Author section */}
        {moreByAuthor.length > 0 ? (
          <>
            <SectionHeading>More by {book.author}</SectionHeading>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
            >
              {moreByAuthor.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => router.push(`/book/${b.id}` as never)}
                  style={{ width: 100 }}
                >
                  <View
                    style={{
                      width: 100,
                      height: 150,
                      borderRadius: 6,
                      overflow: 'hidden',
                      backgroundColor: colors.bgSunken,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 6,
                    }}
                  >
                    {b.cover_url ? (
                      <Image source={{ uri: b.cover_url }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <BookOpen color={colors.textTertiary} size={20} />
                    )}
                  </View>
                  <Text
                    style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textPrimary }}
                    numberOfLines={2}
                  >
                    {b.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
              <Pressable
                onPress={() => router.push(`/author/${authorSlug(book.author)}` as never)}
                className="flex-row items-center"
              >
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText, fontSize: 13 }}>
                  View author page
                </Text>
                <CaretRight color={colors.brandText} size={14} />
              </Pressable>
            </View>
          </>
        ) : null}

        {/* Clubs reading this */}
        {clubs.length > 0 ? (
          <>
            <SectionHeading>Clubs reading this</SectionHeading>
            <View style={{ paddingHorizontal: 20, gap: 8 }}>
              {clubs.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => router.push(`/clubs/${c.id}` as never)}
                  className="flex-row items-center p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                    <Text
                      style={{
                        fontFamily: Fonts.mono,
                        fontSize: 11,
                        color: colors.textTertiary,
                        marginTop: 2,
                      }}
                    >
                      {c.member_count} members
                    </Text>
                  </View>
                  <Text
                    style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}
                  >
                    Open
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <ChapterReactionsSection
            bookId={book.id}
            progressPercentage={userBook?.progress_percentage ?? null}
            inLibrary={Boolean(
              userBook?.status &&
                ['reading', 'finished', 'paused'].includes(userBook.status),
            )}
          />
          <BookDiscussionsSection bookId={book.id} bookSlug={null} />
          <PassageCommentsSection bookId={book.id} />
        </View>
      </ScrollView>

      {/* Add to Library status menu */}
      <BottomSheetMenu
        visible={statusMenuOpen}
        title="Add to library"
        onClose={() => setStatusMenuOpen(false)}
        items={[
          { id: 'want', label: 'Want to Read', onPress: () => setStatus('want_to_read') },
          { id: 'reading', label: 'Currently Reading', onPress: () => setStatus('reading') },
          {
            id: 'now',
            label: 'Start Reading Now',
            onPress: () => {
              setStatus('reading')
              if (book) router.push(`/reader/${book.id}` as never)
            },
          },
          {
            id: 'pause',
            label: 'Pause Reading',
            onPress: () => {
              setPauseNote('')
              setPauseModalOpen(true)
            },
          },
        ]}
      />

      <FinishReviewSheet
        visible={finishReviewUserBookId !== null}
        userBookId={finishReviewUserBookId ?? ''}
        bookTitle={book?.title ?? 'this book'}
        onClose={() => {
          setFinishReviewUserBookId(null)
          const run = finishCelebrationRef.current
          finishCelebrationRef.current = null
          if (run) run()
        }}
      />

      <PauseNoteModal
        visible={pauseModalOpen}
        note={pauseNote}
        onChangeNote={setPauseNote}
        onCancel={() => setPauseModalOpen(false)}
        onConfirm={async () => {
          if (!book || !viewerId) return
          const trimmed = pauseNote.trim()
          await supabase.from('user_books').upsert(
            {
              user_id: viewerId,
              book_id: book.id,
              status: 'paused',
              paused_at: new Date().toISOString(),
              paused_note: trimmed || null,
            },
            { onConflict: 'user_id,book_id' },
          )
          setUserBook((prev) =>
            prev ? { ...prev, status: 'paused' } : prev,
          )
          setPauseModalOpen(false)
        }}
      />

      {/* Share menu */}
      <BottomSheetMenu
        visible={shareMenuOpen}
        title="Share"
        onClose={() => setShareMenuOpen(false)}
        items={[
          {
            id: 'quote',
            label: 'Create Quote Card',
            Icon: ImageSquare,
            onPress: () => {
              if (!book) return
              router.push(
                `/quote-card?bookId=${book.id}&bookTitle=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}` as never,
              )
            },
          },
          {
            id: 'reading',
            label: "I'm Reading This",
            Icon: Megaphone,
            onPress: async () => {
              if (!book) return
              try {
                await Share.share({
                  message: `I'm reading "${book.title}" by ${book.author} on Foxing.`,
                })
              } catch {
                /* user cancelled */
              }
            },
          },
          {
            id: 'recommend',
            label: 'Recommend to a friend',
            Icon: UserPlus,
            onPress: () => {
              if (!book) return
              setRecommendOpen(true)
            },
          },
          {
            id: 'link',
            label: 'Copy link',
            Icon: LinkIcon,
            onPress: async () => {
              if (!book) return
              try {
                await Share.share({ message: `foxing://book/${book.id}` })
              } catch {
                /* user cancelled */
              }
            },
          },
        ]}
      />

      {book ? (
        <RecommendToFriendSheet
          visible={recommendOpen}
          onClose={() => setRecommendOpen(false)}
          bookId={book.id}
          bookTitle={book.title}
        />
      ) : null}
    </View>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function PrimaryCta({
  userBook,
  onAddPress,
  onContinue,
  onReread,
}: {
  userBook: UserBookRow | null
  onAddPress: () => void
  onContinue: () => void
  onReread: () => void
}) {
  const colors = useColors()
  const label =
    userBook?.status === 'reading'
      ? `Continue Reading, ${Math.round((userBook.progress_percentage ?? 0) * 100)}%`
      : userBook?.status === 'finished'
        ? 'Read Again'
        : userBook?.status === 'want_to_read' || userBook?.status === 'abandoned'
          ? 'Start Reading'
          : 'Add to Library'
  const onPress =
    userBook?.status === 'reading'
      ? onContinue
      : userBook?.status === 'finished'
        ? onReread
        : userBook?.status === 'want_to_read' || userBook?.status === 'abandoned'
          ? onContinue
          : onAddPress
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="py-4 rounded-full"
      style={{ backgroundColor: colors.brandUi, marginTop: 12, alignItems: 'center' }}
    >
      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textOnBrand }}>
        {label}
      </Text>
    </Pressable>
  )
}

function SecondaryButton({
  Icon,
  label,
  onPress,
  active,
}: {
  Icon: React.ComponentType<{ color: string; size: number; weight?: 'regular' | 'fill' }>
  label: string
  onPress: () => void
  active?: boolean
}) {
  const colors = useColors()
  return (
    <Pressable
      onPress={onPress}
      className="items-center"
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active ? { selected: true } : undefined}
    >
      <Icon
        color={active ? colors.brandUi : colors.textSecondary}
        size={18}
        weight={active ? 'fill' : 'regular'}
      />
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: active ? colors.brandText : colors.textSecondary,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
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
        marginTop: 22,
        marginBottom: 10,
        paddingHorizontal: 20,
      }}
    >
      {children}
    </Text>
  )
}

function ExpandableText({ text }: { text: string }) {
  const colors = useColors()
  const [expanded, setExpanded] = useState(false)
  if (!text) {
    return (
      <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>
        A classic work from the public domain.
      </Text>
    )
  }
  return (
    <View>
      <Text
        style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textPrimary, lineHeight: 21 }}
        numberOfLines={expanded ? undefined : 4}
      >
        {text}
      </Text>
      {text.length > 220 ? (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={4}>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText, marginTop: 4 }}>
            {expanded ? 'Show less' : 'Show more'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function InsightCard({
  lens,
  label,
  state,
  onOpen,
}: {
  lens: BookInsightLens
  label: string
  state: string | 'loading' | 'error' | undefined
  onOpen: () => void
}) {
  const colors = useColors()
  const [open, setOpen] = useState(false)
  const expand = () => {
    setOpen((v) => !v)
    if (!open && !state) onOpen()
  }
  return (
    <View
      className="rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <Pressable onPress={expand} className="flex-row items-center justify-between p-3">
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
          {label}
        </Text>
        {open ? (
          <CaretDown color={colors.textTertiary} size={14} />
        ) : (
          <CaretRight color={colors.textTertiary} size={14} />
        )}
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          {state === 'loading' ? (
            <ActivityIndicator color={colors.brandUi} />
          ) : state === 'error' ? (
            <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.error }}>
              Couldn't generate this right now.
            </Text>
          ) : typeof state === 'string' ? (
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textPrimary,
                lineHeight: 20,
              }}
            >
              {state}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function DeepDiveCard({
  kind,
  label,
  state,
  onOpen,
}: {
  kind: DeepDiveKind
  label: string
  state: string | 'loading' | 'error' | undefined
  onOpen: () => void
}) {
  const colors = useColors()
  const [open, setOpen] = useState(false)
  // Mirror of InsightCard but with a wider body (deep-dive responses run
  // longer than the 3-4 sentence insight lens responses).
  const expand = () => {
    setOpen((v) => !v)
    if (!open && !state) onOpen()
  }
  void kind // kind is part of the public surface so callers can key state
  return (
    <View
      className="rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <Pressable onPress={expand} className="flex-row items-center justify-between p-3">
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
          {label}
        </Text>
        {open ? (
          <CaretDown color={colors.textTertiary} size={14} />
        ) : (
          <CaretRight color={colors.textTertiary} size={14} />
        )}
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 14 }}>
          {state === 'loading' ? (
            <ActivityIndicator color={colors.brandUi} />
          ) : state === 'error' ? (
            <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.error }}>
              Couldn't generate this right now.
            </Text>
          ) : typeof state === 'string' ? (
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textPrimary,
                lineHeight: 20,
              }}
            >
              {state}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function RecommendToFriendSheet({
  visible,
  onClose,
  bookId,
  bookTitle,
}: {
  visible: boolean
  onClose: () => void
  bookId: string
  bookTitle: string
}) {
  const colors = useColors()
  const [followed, setFollowed] = useState<
    Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }>
  >([])
  const [loading, setLoading] = useState(true)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [viewerName, setViewerName] = useState<string>('')

  useEffect(() => {
    if (!visible) return
    let cancel = false
    setLoading(true)
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancel) setLoading(false)
        return
      }
      const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .maybeSingle()
      const viewer = viewerProfile as { display_name: string | null; username: string | null } | null
      if (!cancel) {
        setViewerName(viewer?.display_name ?? viewer?.username ?? 'A friend')
      }

      const { data } = await supabase
        .from('follows')
        .select('following:profiles!following_id(id, display_name, username, avatar_url)')
        .eq('follower_id', user.id)
        .limit(100)
      if (cancel) return
      type F = {
        following:
          | { id: string; display_name: string | null; username: string | null; avatar_url: string | null }
          | Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }>
          | null
      }
      const rows: Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }> = []
      for (const r of ((data ?? []) as unknown) as F[]) {
        const f = Array.isArray(r.following) ? r.following[0] : r.following
        if (f) rows.push(f)
      }
      rows.sort((a, b) => (a.display_name ?? a.username ?? '').localeCompare(b.display_name ?? b.username ?? ''))
      setFollowed(rows)
      setLoading(false)
    })()
    return () => {
      cancel = true
    }
  }, [visible])

  const recommend = useCallback(
    async (targetId: string) => {
      setSent((prev) => new Set(prev).add(targetId))
      // Best-effort notification + optional record. Notifications table
      // exists; a dedicated recommendations table is optional.
      const { createNotification } = await import('@/lib/notifications')
      await createNotification(
        targetId,
        'book_recommendation',
        `${viewerName} recommends ${bookTitle}`,
        note.trim() || null,
        { book_id: bookId, recommender_note: note.trim() || null },
      )
      try {
        await supabase.from('book_recommendations').insert({
          book_id: bookId,
          recommended_to: targetId,
          note: note.trim() || null,
        })
      } catch {
        /* recommendations table optional */
      }
    },
    [bookId, bookTitle, note, viewerName],
  )

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl pt-4 pb-8 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
          style={{ maxHeight: '80%' }}
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 12,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              paddingHorizontal: 20,
              marginBottom: 8,
            }}
          >
            Recommend to a friend
          </Text>
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <Text
              style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textSecondary }}
              numberOfLines={1}
            >
              {bookTitle}
            </Text>
          </View>
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <NoteInput value={note} onChangeText={setNote} />
          </View>
          {loading ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <ActivityIndicator color={colors.brandUi} />
            </View>
          ) : followed.length === 0 ? (
            <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
              <Text
                style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textTertiary }}
              >
                Follow some readers to share books with them.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 360 }}>
              {followed.map((f) => {
                const name = f.display_name ?? f.username ?? 'Reader'
                const handle = f.username ? `@${f.username}` : ''
                const wasSent = sent.has(f.id)
                return (
                  <View
                    key={f.id}
                    className="flex-row items-center px-5"
                    style={{ minHeight: 56 }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: colors.brandSubtle,
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        marginRight: 12,
                      }}
                    >
                      {f.avatar_url ? (
                        <Image
                          source={{ uri: f.avatar_url }}
                          style={{ width: '100%', height: '100%' }}
                        />
                      ) : (
                        <Text
                          style={{
                            fontFamily: Fonts.uiMedium,
                            fontSize: 14,
                            color: colors.brandSubtleText,
                          }}
                        >
                          {(name[0] ?? '?').toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: Fonts.uiMedium,
                          fontSize: 14,
                          color: colors.textPrimary,
                        }}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                      {handle ? (
                        <Text
                          style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}
                          numberOfLines={1}
                        >
                          {handle}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => !wasSent && recommend(f.id)}
                      disabled={wasSent}
                      className="px-3 py-2 rounded-full"
                      style={{
                        backgroundColor: wasSent ? colors.bgSelected : colors.brandUi,
                        opacity: wasSent ? 0.7 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: Fonts.uiMedium,
                          fontSize: 12,
                          color: wasSent ? colors.brandText : colors.textOnBrand,
                        }}
                      >
                        {wasSent ? 'Sent' : 'Send'}
                      </Text>
                    </Pressable>
                  </View>
                )
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function NoteInput({
  value,
  onChangeText,
}: {
  value: string
  onChangeText: (v: string) => void
}) {
  const colors = useColors()
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="Add a note (optional)"
      placeholderTextColor={colors.textTertiary}
      multiline
      style={{
        fontFamily: Fonts.body,
        fontSize: 14,
        color: colors.textPrimary,
        backgroundColor: colors.bgBase,
        borderColor: colors.borderSubtle,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 60,
      }}
    />
  )
}

function BottomSheetMenu({
  visible,
  title,
  items,
  onClose,
}: {
  visible: boolean
  title: string
  items: Array<{
    id: string
    label: string
    Icon?: React.ComponentType<{ color: string; size: number; weight?: 'regular' }>
    onPress: () => void
  }>
  onClose: () => void
}) {
  const colors = useColors()
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl pt-4 pb-8 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 12,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              paddingHorizontal: 20,
              marginBottom: 8,
            }}
          >
            {title}
          </Text>
          {items.map((item, i) => (
            <Pressable
              key={item.id}
              onPress={() => {
                item.onPress()
                onClose()
              }}
              className="flex-row items-center px-5"
              style={{
                minHeight: 56,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.borderSubtle,
              }}
            >
              {item.Icon ? (
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: colors.brandSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <item.Icon color={colors.brandUi} size={16} />
                </View>
              ) : null}
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// Pause confirmation + optional note. Centered modal, pauses are intentional
// and the note tends to be a sentence at most, so a small dialog fits.
function PauseNoteModal({
  visible,
  note,
  onChangeNote,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  note: string
  onChangeNote: (v: string) => void
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  const colors = useColors()
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <Pressable
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: colors.overlay }}
        onPress={onCancel}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
          className="w-full p-5 rounded-2xl bg-bg-elevated-light dark:bg-bg-elevated-dark"
        >
          <Text
            style={{
              fontFamily: Fonts.displayBold,
              fontSize: 16,
              color: colors.textPrimary,
              marginBottom: 6,
            }}
          >
            Pause reading
          </Text>
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 13,
              color: colors.textSecondary,
              marginBottom: 12,
            }}
          >
            Why are you pausing? (optional)
          </Text>
          <TextInput
            value={note}
            onChangeText={onChangeNote}
            placeholder="Taking a break, life got busy..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={280}
            accessibilityLabel="Pause note"
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textPrimary,
              backgroundColor: colors.bgBase,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              minHeight: 80,
              textAlignVertical: 'top',
              marginBottom: 12,
            }}
          />
          <View className="flex-row justify-end" style={{ gap: 10 }}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              className="px-4 py-2"
            >
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textSecondary }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel="Pause book"
              className="px-4 py-2 rounded-full"
              style={{ backgroundColor: colors.brandUi }}
            >
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                Pause
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
