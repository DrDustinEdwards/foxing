import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Newspaper,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import {
  type ActivityEvent,
  PAGE_SIZE,
  fetchActivityPage,
  getFollowedIds,
  hydrateEvents,
} from '@/lib/feed'
import { getUnreadCount, weeklyDigestCheck } from '@/lib/notifications'
import { FeedRow, makeEventFromRealtime } from '@/components/feed/feed-row'
import { FeedEmptyState, FeedHeader, FeedListEmpty, FeedListFooter, type PopularReview, PopularSection, type TrendingBook } from '@/components/feed/feed-sections'

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

// ── FeedRow ───────────────────────────────────────────────────────────────

