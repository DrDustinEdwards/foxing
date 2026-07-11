import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Newspaper,
  BookOpen,
  Bookmark,
  CheckCircle,
  HighlighterCircle,
  MagnifyingGlass,
  Trophy,
  UserPlus,
  Bell,
  ChatCircle,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  type ActivityEvent,
  type ActivityType,
  PAGE_SIZE,
  fetchActivityPage,
  getFollowedIds,
  hydrateEvents,
  relativeTime,
} from '@/lib/feed'
import { getUnreadCount, weeklyDigestCheck } from '@/lib/notifications'
import { ActorNameText } from '@/components/feed/actor-name-text'
import { TrendingBookCard } from '@/components/feed/trending-book-card'
import { PopularReviewCard } from '@/components/feed/popular-review-card'

interface PopularReview {
  id: string
  rating: number | null
  review: string
  user: {
    id: string
    display_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
  book: { id: string; title: string; cover_url: string | null } | null
}

interface TrendingBook {
  id: string
  title: string
  author: string
  cover_url: string | null
  readerCount: number
}

export default function FeedScreen() {
  const colors = useColors()
  const router = useRouter()
  const [eventsMap, setEventsMap] = useState<Map<string, ActivityEvent>>(new Map())
  const [followedIds, setFollowedIds] = useState<string[] | null>(null)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Bell badge, live-updated via the notifications realtime channel.
  const [unreadCount, setUnreadCount] = useState(0)
  // Always-on "Popular on Foxing this week" block, ensures the feed has
  // content even for users with zero follows.
  const [popularReviews, setPopularReviews] = useState<PopularReview[]>([])
  const [trendingBooks, setTrendingBooks] = useState<TrendingBook[]>([])

  // Refs so realtime callbacks (registered once) always see latest state.
  const followedIdsRef = useRef<string[]>([])
  followedIdsRef.current = followedIds ?? []
  const eventsMapRef = useRef(eventsMap)
  eventsMapRef.current = eventsMap

  // Cursor = oldest event's timestamp. Used by `lt` filter on the next page.
  const cursorRef = useRef<string | null>(null)

  // Load the always-shown Popular block. Top reviews by like count + most-
  // started books from the last 7 days. Best-effort, if review_likes
  // doesn't exist, fall back to most recent public reviews.
  const loadPopular = useCallback(async () => {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
    // Top reviews by likes, left-join review_likes and aggregate client-side.
    let reviews: PopularReview[] = []
    try {
      const { data } = await supabase
        .from('user_books')
        .select('id, rating, review, user:profiles!user_id(id, display_name, username, avatar_url), book:books(id, title, cover_url)')
        .eq('review_is_public', true)
        .not('review', 'is', null)
        .gte('updated_at', since)
        .limit(10)
      type R = {
        id: string
        rating: number | null
        review: string | null
        user: PopularReview['user'] | Array<NonNullable<PopularReview['user']>> | null
        book: PopularReview['book'] | Array<NonNullable<PopularReview['book']>> | null
      }
      for (const r of ((data ?? []) as unknown) as R[]) {
        if (!r.review) continue
        const u = Array.isArray(r.user) ? r.user[0] ?? null : r.user
        const b = Array.isArray(r.book) ? r.book[0] ?? null : r.book
        reviews.push({
          id: r.id,
          rating: r.rating,
          review: r.review,
          user: u,
          book: b,
        })
      }
      reviews = reviews.slice(0, 5)
    } catch (e) {
      console.warn('[feed] popular reviews failed:', e instanceof Error ? e.message : e)
    }
    // Trending books, most user_books inserts in the last 7 days.
    let trending: TrendingBook[] = []
    try {
      const { data: starts } = await supabase
        .from('user_books')
        .select('book_id')
        .gte('created_at', since)
        .limit(500)
      const counts = new Map<string, number>()
      for (const r of ((starts ?? []) as Array<{ book_id: string }>)) {
        counts.set(r.book_id, (counts.get(r.book_id) ?? 0) + 1)
      }
      const topIds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id)
      if (topIds.length > 0) {
        const { data: books } = await supabase
          .from('books')
          .select('id, title, author, cover_url')
          .in('id', topIds)
        for (const b of ((books ?? []) as Array<{ id: string; title: string; author: string; cover_url: string | null }>)) {
          trending.push({ ...b, readerCount: counts.get(b.id) ?? 0 })
        }
        // Preserve count-based ordering.
        trending.sort((a, b) => b.readerCount - a.readerCount)
      }
    } catch (e) {
      console.warn('[feed] trending books failed:', e instanceof Error ? e.message : e)
    }
    setPopularReviews(reviews)
    setTrendingBooks(trending)
  }, [])

  // ── First-load: viewer + followed IDs ────────────────────────────────────
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      if (!user) {
        setViewerId(null)
        setFollowedIds([])
        setLoading(false)
        return
      }
      setViewerId(user.id)
      const ids = await getFollowedIds(user.id)
      if (!mounted) return
      setFollowedIds(ids)
      // Weekly digest, runs once per Sunday (idempotent via AsyncStorage).
      weeklyDigestCheck().catch(() => {})
      // Pull the popular block in parallel with the followed-ids fetch.
      loadPopular().catch(() => {})
    })()
    return () => {
      mounted = false
    }
  }, [])

  // ── Initial page fetch once we know who we follow ────────────────────────
  const loadInitial = useCallback(async () => {
    if (!followedIds) return
    setLoading(true)
    setError(null)
    cursorRef.current = null
    try {
      const page = await fetchActivityPage(followedIds, null)
      const hydrated = await hydrateEvents(page)
      const next = new Map<string, ActivityEvent>()
      for (const e of hydrated) next.set(e.key, e)
      setEventsMap(next)
      cursorRef.current = hydrated.length ? hydrated[hydrated.length - 1].createdAt : null
      setHasMore(hydrated.length >= PAGE_SIZE)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed')
    } finally {
      setLoading(false)
    }
  }, [followedIds])

  useEffect(() => {
    if (followedIds !== null) loadInitial()
  }, [followedIds, loadInitial])

  // ── Pull-to-refresh: re-fetch top-of-feed and merge into existing state ──
  const onRefresh = useCallback(async () => {
    if (!followedIds || followedIds.length === 0) return
    setRefreshing(true)
    try {
      const page = await fetchActivityPage(followedIds, null)
      const hydrated = await hydrateEvents(page)
      // Merge: keep existing events but overlay any fresh duplicates with the
      // newly fetched copy. Don't reset cursor, the cursor still points at
      // the oldest event we know about, and that's what `Load more` uses.
      setEventsMap((prev) => {
        const next = new Map(prev)
        for (const e of hydrated) next.set(e.key, e)
        return next
      })
    } catch (e) {
      console.warn('[feed] refresh failed:', e instanceof Error ? e.message : e)
    } finally {
      setRefreshing(false)
    }
  }, [followedIds])

  // ── Infinite scroll: append the next page ────────────────────────────────
  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMore || !followedIds || followedIds.length === 0) return
    if (!cursorRef.current) return
    setLoadingMore(true)
    try {
      const page = await fetchActivityPage(followedIds, cursorRef.current)
      const hydrated = await hydrateEvents(page)
      if (hydrated.length === 0) {
        setHasMore(false)
        return
      }
      setEventsMap((prev) => {
        const next = new Map(prev)
        for (const e of hydrated) next.set(e.key, e)
        return next
      })
      cursorRef.current = hydrated[hydrated.length - 1].createdAt
      setHasMore(hydrated.length >= PAGE_SIZE)
    } catch (e) {
      console.warn('[feed] loadMore failed:', e instanceof Error ? e.message : e)
    } finally {
      setLoadingMore(false)
    }
  }, [followedIds, hasMore, loadingMore])

  // ── Notifications: load count + subscribe to live INSERTs ─────────────
  useEffect(() => {
    if (!viewerId) {
      setUnreadCount(0)
      return
    }
    getUnreadCount(viewerId).then(setUnreadCount).catch(() => {})
    const channel = supabase
      .channel(`notifications-${viewerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${viewerId}`,
        },
        () => setUnreadCount((c) => c + 1),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [viewerId])

  // ── Realtime: subscribe to inserts on the three highest-signal tables ───
  // Only the actor/book IDs come through the realtime payload; we hydrate
  // inline before prepending. Filter by followedIdsRef so we don't render
  // strangers' events even if RLS would have allowed them through.
  useEffect(() => {
    if (!viewerId) return

    const handleInsert = async (
      table: 'highlights' | 'user_books' | 'follows',
      row: Record<string, unknown>,
    ) => {
      const ids = followedIdsRef.current
      const candidate = makeEventFromRealtime(table, row)
      if (!candidate) return
      // Filter: only events from people the viewer follows.
      if (!ids.includes(candidate.actorId)) return
      // Dedupe: realtime may race with a refresh. If the key is already in
      // the map, drop this one.
      if (eventsMapRef.current.has(candidate.key)) return
      try {
        const [hydrated] = await hydrateEvents([candidate])
        setEventsMap((prev) => {
          if (prev.has(hydrated.key)) return prev
          const next = new Map(prev)
          next.set(hydrated.key, hydrated)
          return next
        })
      } catch (e) {
        console.warn('[feed] realtime hydrate failed:', e instanceof Error ? e.message : e)
      }
    }

    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'highlights' }, (p: any) =>
        handleInsert('highlights', p.new as Record<string, unknown>),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_books' }, (p: any) =>
        handleInsert('user_books', p.new as Record<string, unknown>),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'follows' }, (p: any) =>
        handleInsert('follows', p.new as Record<string, unknown>),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [viewerId])

  const sortedEvents = useMemo(() => {
    return Array.from(eventsMap.values()).sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    )
  }, [eventsMap])

  // ── Render ───────────────────────────────────────────────────────────────




  // First-load shimmer, only show the centered indicator before any state
  // resolves. Pull-to-refresh has its own indicator.
  if (loading && eventsMap.size === 0) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
        <FeedHeader unread={unreadCount} onBell={() => router.push('/notifications' as never)} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      </SafeAreaView>
    )
  }

  if (!viewerId) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
        <FeedHeader unread={unreadCount} onBell={() => router.push('/notifications' as never)} />
        <FeedEmptyState
          icon={<Newspaper color={colors.brandSubtleText} size={32} weight="regular" />}
          title="Sign in to see your feed"
          body="Once you're signed in and following other readers, their activity will appear here."
        />
      </SafeAreaView>
    )
  }

  const showFindReadersCard = !followedIds || followedIds.length < 3
  const hasNoFollows = !followedIds || followedIds.length === 0

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <FeedHeader unread={unreadCount} onBell={() => router.push('/notifications' as never)} />
      <FlatList
        ListHeaderComponent={
          <PopularSection
            showFindReaders={showFindReadersCard}
            onFindReaders={() => router.push('/discover-readers' as never)}
            reviews={popularReviews}
            trending={trendingBooks}
            onPressBook={(id) => router.push(`/book/${id}` as never)}
            onPressUser={(id) => router.push(`/user/${id}` as never)}
            sectionLabel={hasNoFollows ? null : 'From people you follow'}
          />
        }
        data={sortedEvents}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <FeedRow
            event={item}
            onPressActor={() =>
              item.actor ? router.push(`/user/${item.actor.id}` as never) : undefined
            }
            onPressBook={() =>
              item.book ? router.push(`/book/${item.book.id}` as never) : undefined
            }
            onPressTarget={() =>
              item.targetUser ? router.push(`/user/${item.targetUser.id}` as never) : undefined
            }
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 64 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brandUi}
            colors={[colors.brandUi]}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={<FeedListEmpty error={error} hasNoFollows={hasNoFollows} />}
        ListFooterComponent={
          <FeedListFooter
            loadingMore={loadingMore}
            hasMore={hasMore}
            count={sortedEvents.length}
          />
        }
      />
    </SafeAreaView>
  )
}

// ── Realtime row → ActivityEvent skeleton (hydrated separately) ───────────

function makeEventFromRealtime(
  table: 'highlights' | 'user_books' | 'follows',
  row: Record<string, unknown>,
): ActivityEvent | null {
  if (table === 'highlights') {
    const id = String(row.id ?? '')
    const userId = String(row.user_id ?? '')
    if (!id || !userId) return null
    return {
      key: `highlight:${id}`,
      type: 'highlighted',
      actorId: userId,
      bookId: (row.book_id as string | null) ?? null,
      text: (row.text as string | undefined) ?? undefined,
      color: (row.color as string | null) ?? null,
      createdAt: String(row.created_at ?? new Date().toISOString()),
    }
  }
  if (table === 'follows') {
    const follower = String(row.follower_id ?? '')
    const following = String(row.following_id ?? '')
    if (!follower || !following) return null
    return {
      key: `follow:${follower}:${following}`,
      type: 'followed_user',
      actorId: follower,
      targetUserId: following,
      createdAt: String(row.created_at ?? new Date().toISOString()),
    }
  }
  // user_books, a single insert can represent any of three actions.
  // INSERTs cover added_to_library and started/finished from-scratch. UPDATEs
  // would fire for status changes, but we don't subscribe to UPDATEs in v1.
  const id = String(row.id ?? '')
  const userId = String(row.user_id ?? '')
  if (!id || !userId) return null
  const status = (row.status as string) ?? ''
  const startedAt = row.started_at as string | null
  const finishedAt = row.finished_at as string | null
  const createdAt = String(row.created_at ?? new Date().toISOString())
  let type: ActivityType
  let ts = createdAt
  if (status === 'finished' && finishedAt) {
    type = 'finished_book'
    ts = finishedAt
  } else if (startedAt) {
    type = 'started_book'
    ts = startedAt
  } else {
    type = 'added_to_library'
  }
  const keyPrefix = type === 'finished_book' ? 'finished' : type === 'started_book' ? 'started' : 'added'
  return {
    key: `${keyPrefix}:${id}`,
    type,
    actorId: userId,
    bookId: (row.book_id as string | null) ?? null,
    createdAt: ts,
  }
}

// ── FeedRow ───────────────────────────────────────────────────────────────

function FeedRow({
  event,
  onPressActor,
  onPressBook,
  onPressTarget,
}: {
  event: ActivityEvent
  onPressActor?: () => void
  onPressBook?: () => void
  onPressTarget?: () => void
}) {
  const colors = useColors()
  const actorName = event.actor?.display_name ?? event.actor?.username ?? 'Reader'
  const Icon = iconForType(event.type)

  return (
    <View
      className="flex-row p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <Pressable onPress={onPressActor} hitSlop={4}>
        <Avatar actor={event.actor ?? null} size={40} />
      </Pressable>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View className="flex-row items-center" style={{ marginBottom: 2 }}>
          <Icon color={colors.brandText} size={14} weight="regular" />
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 11,
              color: colors.textTertiary,
              marginLeft: 6,
            }}
          >
            {relativeTime(event.createdAt)}
          </Text>
        </View>
        <ActionLine
          event={event}
          actorName={actorName}
          onPressActor={onPressActor}
          onPressBook={onPressBook}
          onPressTarget={onPressTarget}
        />
        {event.type === 'highlighted' && event.text ? (
          <View
            style={{
              marginTop: 8,
              padding: 10,
              borderLeftWidth: 3,
              borderLeftColor: highlightAccentFor(event.color, colors.brandUi),
              backgroundColor: colors.bgSunken,
              borderRadius: 6,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textPrimary,
                lineHeight: 19,
                fontStyle: 'italic',
              }}
              numberOfLines={3}
            >
              “{event.text}”
            </Text>
          </View>
        ) : null}
        {event.type === 'chapter_reaction' && event.text ? (
          <View
            style={{
              marginTop: 8,
              padding: 10,
              borderLeftWidth: 3,
              borderLeftColor: colors.brandUi,
              backgroundColor: colors.bgSunken,
              borderRadius: 6,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textPrimary,
                lineHeight: 19,
                fontStyle: 'italic',
              }}
              numberOfLines={3}
            >
              "{event.text}"
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

function ActionLine({
  event,
  actorName,
  onPressActor,
  onPressBook,
  onPressTarget,
}: {
  event: ActivityEvent
  actorName: string
  onPressActor?: () => void
  onPressBook?: () => void
  onPressTarget?: () => void
}) {
  const colors = useColors()
  const nameText = <ActorNameText name={actorName} onPress={onPressActor} />
  const bookText = event.book ? (
    <Text
      onPress={onPressBook}
      style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.brandText }}
      numberOfLines={1}
    >
      {event.book.title}
    </Text>
  ) : (
    <Text style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textTertiary }}>
      a book
    </Text>
  )

  const base = { fontFamily: Fonts.ui, fontSize: 14, color: colors.textSecondary } as const

  switch (event.type) {
    case 'started_book':
      return <Text style={base}>{nameText} started reading {bookText}</Text>
    case 'finished_book':
      return <Text style={base}>{nameText} finished {bookText}</Text>
    case 'added_to_library':
      return <Text style={base}>{nameText} added {bookText} to their library</Text>
    case 'highlighted':
      return <Text style={base}>{nameText} highlighted from {bookText}</Text>
    case 'looked_up_word':
      return (
        <Text style={base}>
          {nameText} looked up{' '}
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary }}>
            {event.word ?? 'a word'}
          </Text>{' '}
          in {bookText}
        </Text>
      )
    case 'earned_badge':
      return (
        <Text style={base}>
          {nameText} earned the{' '}
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary }}>
            {event.badge?.name ?? 'a'}
          </Text>{' '}
          badge
        </Text>
      )
    case 'followed_user': {
      const target = event.targetUser?.display_name ?? event.targetUser?.username ?? 'a reader'
      return (
        <Text style={base}>
          {nameText} followed{' '}
          <Text
            onPress={onPressTarget}
            style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}
          >
            {target}
          </Text>
        </Text>
      )
    }
    case 'chapter_reaction':
      return (
        <Text style={base}>
          {nameText} reacted{' '}
          <Text style={{ fontSize: 16 }}>{event.reactionEmoji ?? ''}</Text>
          {' to '}
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary }}>
            {event.reactionChapter || 'a chapter'}
          </Text>
          {event.book ? <Text>{' of '}{bookText}</Text> : null}
        </Text>
      )
  }
}

function Avatar({ actor, size }: { actor: { avatar_url: string | null; display_name: string | null; username: string | null } | null; size: number }) {
  const colors = useColors()
  const initial =
    (actor?.display_name || actor?.username || '?')[0]?.toUpperCase() ?? '?'
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brandSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {actor?.avatar_url ? (
        <Image source={{ uri: actor.avatar_url }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text
          style={{
            fontFamily: Fonts.display,
            fontSize: size * 0.42,
            color: colors.brandSubtleText,
          }}
        >
          {initial}
        </Text>
      )}
    </View>
  )
}

function FollowSuggestions({
  viewerId,
  onFollowed,
}: {
  viewerId: string
  onFollowed: () => void
}) {
  const colors = useColors()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [suggestions, setSuggestions] = useState<
    Array<{
      id: string
      display_name: string | null
      username: string | null
      avatar_url: string | null
      finishedCount: number
    }>
  >([])
  const [followedThisSession, setFollowedThisSession] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancel = false
    ;(async () => {
      // Pull a sample of recently finished books to find active readers.
      // Aggregating client-side keeps us off RPCs.
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
      const { data } = await supabase
        .from('user_books')
        .select('user_id, profile:profiles(id, display_name, username, avatar_url)')
        .eq('status', 'finished')
        .gte('finished_at', since)
        .neq('user_id', viewerId)
        .limit(200)
      if (cancel) return
      type R = {
        user_id: string
        profile:
          | { id: string; display_name: string | null; username: string | null; avatar_url: string | null }
          | Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }>
          | null
      }
      const counts = new Map<
        string,
        {
          profile: { id: string; display_name: string | null; username: string | null; avatar_url: string | null }
          n: number
        }
      >()
      for (const r of ((data ?? []) as unknown) as R[]) {
        const p = Array.isArray(r.profile) ? r.profile[0] : r.profile
        if (!p) continue
        const cur = counts.get(r.user_id) ?? { profile: p, n: 0 }
        cur.n += 1
        counts.set(r.user_id, cur)
      }
      const ranked = [...counts.values()]
        .sort((a, b) => b.n - a.n)
        .slice(0, 8)
        .map((v) => ({
          id: v.profile.id,
          display_name: v.profile.display_name,
          username: v.profile.username,
          avatar_url: v.profile.avatar_url,
          finishedCount: v.n,
        }))
      setSuggestions(ranked)
      setLoading(false)
    })()
    return () => {
      cancel = true
    }
  }, [viewerId])

  const follow = useCallback(
    async (targetId: string) => {
      setFollowedThisSession((prev) => new Set(prev).add(targetId))
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: viewerId, following_id: targetId })
      if (error) {
        // Revert optimistic.
        setFollowedThisSession((prev) => {
          const next = new Set(prev)
          next.delete(targetId)
          return next
        })
        return
      }
      onFollowed()
    },
    [onFollowed, viewerId],
  )

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 64 }}>
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandSubtle,
            marginBottom: 12,
          }}
        >
          <UserPlus color={colors.brandSubtleText} size={32} weight="regular" />
        </View>
        <Text
          style={{
            fontFamily: Fonts.display,
            fontSize: 18,
            color: colors.textPrimary,
            textAlign: 'center',
            marginBottom: 4,
          }}
        >
          Follow other readers
        </Text>
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 13,
            color: colors.textTertiary,
            textAlign: 'center',
            lineHeight: 19,
            maxWidth: 280,
          }}
        >
          Highlights, finishes, and notes from people you follow will land here.
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.brandUi} />
      ) : suggestions.length === 0 ? (
        <Pressable
          onPress={() => router.push('/discover-readers' as never)}
          className="px-4 py-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark items-center"
        >
          <Text
            style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.brandText }}
          >
            Find readers →
          </Text>
        </Pressable>
      ) : (
        <View>
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 8,
            }}
          >
            Suggested for you
          </Text>
          <View style={{ gap: 8 }}>
            {suggestions.map((s) => {
              const name = s.display_name ?? s.username ?? 'Reader'
              const handle = s.username ? `@${s.username}` : ''
              const followed = followedThisSession.has(s.id)
              return (
                <View
                  key={s.id}
                  className="flex-row items-center p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <Pressable onPress={() => router.push(`/user/${s.id}` as never)} hitSlop={4}>
                    <Avatar
                      actor={{
                        avatar_url: s.avatar_url,
                        display_name: s.display_name,
                        username: s.username,
                      }}
                      size={40}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => router.push(`/user/${s.id}` as never)}
                    style={{ flex: 1, marginLeft: 12 }}
                  >
                    <Text
                      style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    <Text
                      style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}
                      numberOfLines={1}
                    >
                      {handle ? `${handle} · ` : ''}
                      {s.finishedCount} book{s.finishedCount === 1 ? '' : 's'} this month
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => !followed && follow(s.id)}
                    disabled={followed}
                    className="px-3 py-2 rounded-full"
                    style={{
                      backgroundColor: followed ? colors.bgSelected : colors.brandUi,
                      opacity: followed ? 0.7 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 12,
                        color: followed ? colors.brandText : colors.textOnBrand,
                      }}
                    >
                      {followed ? 'Following' : 'Follow'}
                    </Text>
                  </Pressable>
                </View>
              )
            })}
          </View>
          <Pressable
            onPress={() => router.push('/discover-readers' as never)}
            style={{ marginTop: 16, alignSelf: 'center', padding: 8 }}
          >
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}>
              See more readers
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  )
}

function FeedEmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  const colors = useColors()
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingTop: 80,
        paddingBottom: 64,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brandSubtle,
          marginBottom: 16,
        }}
      >
        {icon}
      </View>
      <Text
        style={{
          fontFamily: Fonts.display,
          fontSize: 18,
          color: colors.textPrimary,
          textAlign: 'center',
          marginBottom: 6,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: 14,
          color: colors.textTertiary,
          textAlign: 'center',
          lineHeight: 20,
        }}
      >
        {body}
      </Text>
    </View>
  )
}

function FeedListEmpty({
  error,
  hasNoFollows,
}: {
  error: string | null
  hasNoFollows: boolean
}) {
  const colors = useColors()
  if (error) {
    return (
      <FeedEmptyState
        icon={<Newspaper color={colors.error} size={32} weight="regular" />}
        title="Couldn't load feed"
        body={error}
      />
    )
  }
  if (hasNoFollows) return null
  return (
    <FeedEmptyState
      icon={<Newspaper color={colors.brandSubtleText} size={32} weight="regular" />}
      title="Quiet for now"
      body="No recent activity from the readers you follow."
    />
  )
}

function FeedListFooter({
  loadingMore,
  hasMore,
  count,
}: {
  loadingMore: boolean
  hasMore: boolean
  count: number
}) {
  const colors = useColors()
  if (loadingMore) {
    return (
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <ActivityIndicator color={colors.brandUi} />
      </View>
    )
  }
  if (!hasMore && count > 0) {
    return (
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>
          You're all caught up.
        </Text>
      </View>
    )
  }
  return null
}

function FeedHeader({ unread, onBell }: { unread: number; onBell: () => void }) {
  const colors = useColors()
  const router = useRouter()
  return (
    <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
      <Text style={{ fontFamily: Fonts.displayBold, fontSize: 22, color: colors.textPrimary }}>
        Feed
      </Text>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <Pressable
          onPress={() => router.push('/discover-readers' as never)}
          hitSlop={6}
          accessibilityLabel="Find readers"
          className="px-3 py-1 rounded-full border"
          style={{ borderColor: colors.borderSubtle }}
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.textPrimary,
            }}
          >
            Find readers
          </Text>
        </Pressable>
        <Pressable
          onPress={onBell}
          hitSlop={10}
          accessibilityLabel="Notifications"
          style={{ padding: 4 }}
        >
          <Bell color={colors.textPrimary} size={22} weight="regular" />
          {unread > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: colors.brandUi,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 9,
                  color: colors.textOnBrand,
                }}
              >
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  )
}

// Map type → phosphor icon component.
function iconForType(type: ActivityType) {
  switch (type) {
    case 'started_book':
      return BookOpen
    case 'finished_book':
      return CheckCircle
    case 'added_to_library':
      return Bookmark
    case 'highlighted':
      return HighlighterCircle
    case 'looked_up_word':
      return MagnifyingGlass
    case 'earned_badge':
      return Trophy
    case 'followed_user':
      return UserPlus
    case 'chapter_reaction':
      return ChatCircle
  }
}

// Map a highlight color slug → an accent hex (for the left border of the
// quoted text block). Falls back to brand amber for unknown / unset.
function highlightAccentFor(color: string | null | undefined, fallback: string): string {
  switch (color) {
    case 'amber': return '#F5C060'
    case 'auburn': return '#F0A070'
    case 'yellow': return '#F4E47B'
    case 'sage': return '#72CA9A'
    case 'cobalt': return '#70A6DB'
    case 'crimson': return '#E46872'
    case 'purple': return '#B58DE2'
    default: return fallback
  }
}

// "Popular on Foxing this week" + optional Find Readers card. Always rendered
// as the FlatList header so the feed has content even when the user follows
// no one.
function PopularSection({
  showFindReaders,
  onFindReaders,
  reviews,
  trending,
  onPressBook,
  onPressUser,
  sectionLabel,
}: {
  showFindReaders: boolean
  onFindReaders: () => void
  reviews: PopularReview[]
  trending: TrendingBook[]
  onPressBook: (id: string) => void
  onPressUser: (id: string) => void
  sectionLabel: string | null
}) {
  const colors = useColors()
  return (
    <View style={{ marginBottom: 12 }}>
      {showFindReaders ? (
        <Pressable
          onPress={onFindReaders}
          accessibilityRole="button"
          accessibilityLabel="Find readers like you"
          className="flex-row items-center p-4 mb-3 rounded-2xl border"
          style={{
            backgroundColor: colors.brandSubtle,
            borderColor: colors.borderBrand,
            gap: 12,
          }}
        >
          <UserPlus color={colors.brandSubtleText} size={20} />
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.brandSubtleText }}
            >
              Find readers like you
            </Text>
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 12,
                color: colors.brandSubtleText,
                opacity: 0.85,
                marginTop: 2,
              }}
            >
              We'll fill your feed once you follow a few people.
            </Text>
          </View>
        </Pressable>
      ) : null}

      <SectionLabel>Popular on Foxing this week</SectionLabel>
      {reviews.length === 0 && trending.length === 0 ? (
        <View
          className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          <Text
            style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textTertiary }}
          >
            Check back in a day, the community's still warming up.
          </Text>
        </View>
      ) : (
        <>
          {trending.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingRight: 12 }}
              style={{ marginBottom: 12 }}
            >
              {trending.map((b) => (
                <TrendingBookCard
                  key={b.id}
                  id={b.id}
                  title={b.title}
                  author={b.author}
                  coverUrl={b.cover_url}
                  readerCount={b.readerCount}
                  onPress={onPressBook}
                />
              ))}
            </ScrollView>
          ) : null}

          {reviews.map((r) => (
            <PopularReviewCard
              key={r.id}
              rating={r.rating}
              review={r.review}
              user={r.user}
              book={r.book}
              onPressBook={onPressBook}
              onPressUser={onPressUser}
            />
          ))}
        </>
      )}

      {sectionLabel ? (
        <View style={{ marginTop: 18, marginBottom: 6 }}>
          <SectionLabel>{sectionLabel}</SectionLabel>
        </View>
      ) : null}
    </View>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <Text
      style={{
        fontFamily: Fonts.uiMedium,
        fontSize: 11,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  )
}
