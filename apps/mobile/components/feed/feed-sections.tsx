import { useColors } from '@/constants/colors'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { Bell, Newspaper, UserPlus } from 'phosphor-react-native'
import { Fonts } from '@/constants/fonts'
import { Avatar } from '@/components/feed/feed-row'
import { TrendingBookCard } from '@/components/feed/trending-book-card'
import { PopularReviewCard } from '@/components/feed/popular-review-card'

export interface PopularReview {
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

export interface TrendingBook {
  id: string
  title: string
  author: string
  cover_url: string | null
  readerCount: number
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

export function FeedEmptyState({
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

export function FeedListEmpty({
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

export function FeedListFooter({
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

export function FeedHeader({ unread, onBell }: { unread: number; onBell: () => void }) {
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

// "Popular on Foxing this week" + optional Find Readers card. Always rendered
// as the FlatList header so the feed has content even when the user follows
// no one.
export function PopularSection({
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
