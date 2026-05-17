import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft, BookOpen } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { FollowButton } from '@/components/profile/follow-button'

interface ProfileRow {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  favorite_genres?: string[] | null
}

interface CommonplaceEntryRow {
  id: string
  passage_text: string
  book: { id: string; title: string; author: string } | null
}

interface PublicClubRow {
  id: string
  name: string
  member_count: number
}

interface CurrentlyReadingRow {
  id: string
  progress_percentage: number | null
  book: { id: string; title: string; author: string; cover_url: string | null } | null
}

interface Counts {
  followers: number
  following: number
  booksRead: number
}

const ZERO_COUNTS: Counts = { followers: 0, following: 0, booksRead: 0 }

export default function UserProfileScreen() {
  const colors = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [counts, setCounts] = useState<Counts>(ZERO_COUNTS)
  const [reading, setReading] = useState<CurrentlyReadingRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [viewerId, setViewerId] = useState<string | null>(null)
  // Taste compatibility, based on overlap of favorite_genres + finished
  // books in common. Only computed when viewer ≠ subject.
  const [tasteMatch, setTasteMatch] = useState<number | null>(null)
  const [booksInCommon, setBooksInCommon] = useState<number>(0)
  // Public surfaces, commonplace and clubs.
  const [publicCommonplace, setPublicCommonplace] = useState<CommonplaceEntryRow[]>([])
  const [publicClubs, setPublicClubs] = useState<PublicClubRow[]>([])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    const { data: { user } } = await supabase.auth.getUser()
    setViewerId(user?.id ?? null)

    const [profileRes, followersRes, followingRes, booksReadRes, readingRes, commonplaceRes, clubsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, favorite_genres')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('following_id', id),
      supabase
        .from('follows')
        .select('following_id', { count: 'exact', head: true })
        .eq('follower_id', id),
      supabase
        .from('user_books')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', id)
        .eq('status', 'finished'),
      supabase
        .from('user_books')
        .select('id, progress_percentage, book:books(id, title, author, cover_url)')
        .eq('user_id', id)
        .eq('status', 'reading')
        .order('started_at', { ascending: false, nullsFirst: false })
        .limit(1),
      supabase
        .from('commonplace_entries')
        .select('id, passage_text, book:books(id, title, author)')
        .eq('user_id', id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(3),
      // Public clubs the subject is in. Two-step: pull memberships, filter
      // by public clubs.
      supabase
        .from('club_members')
        .select('clubs:club_id(id, name, member_count, is_public)')
        .eq('user_id', id)
        .limit(20),
    ])

    if (!profileRes.data) {
      setNotFound(true)
      setLoading(false)
      return
    }
    const profileRow = profileRes.data as ProfileRow
    setProfile(profileRow)
    setCounts({
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
      booksRead: booksReadRes.count ?? 0,
    })
    const row = (readingRes.data?.[0] as unknown) as CurrentlyReadingRow | undefined
    setReading(row ?? null)

    // Normalize joined "book" relation on commonplace entries.
    const cpRaw = ((commonplaceRes.data ?? []) as Array<{
      id: string
      passage_text: string
      book: { id: string; title: string; author: string }
        | Array<{ id: string; title: string; author: string }>
        | null
    }>)
    setPublicCommonplace(
      cpRaw.map((c) => ({
        id: c.id,
        passage_text: c.passage_text,
        book: Array.isArray(c.book) ? c.book[0] ?? null : c.book,
      })),
    )

    // Filter to public clubs only.
    const clubRaw = ((clubsRes.data ?? []) as Array<{
      clubs: { id: string; name: string; member_count: number; is_public: boolean }
        | Array<{ id: string; name: string; member_count: number; is_public: boolean }>
        | null
    }>)
    const clubs: PublicClubRow[] = []
    for (const r of clubRaw) {
      const c = Array.isArray(r.clubs) ? r.clubs[0] : r.clubs
      if (c && c.is_public) clubs.push({ id: c.id, name: c.name, member_count: c.member_count })
    }
    setPublicClubs(clubs)

    // Taste compatibility, only compute when viewing someone else.
    if (user && user.id !== id) {
      try {
        const [meRes, myFinishedRes, theirFinishedRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('favorite_genres')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('user_books')
            .select('book_id')
            .eq('user_id', user.id)
            .eq('status', 'finished'),
          supabase
            .from('user_books')
            .select('book_id')
            .eq('user_id', id)
            .eq('status', 'finished'),
        ])
        const myGenres = ((meRes.data as { favorite_genres: string[] | null } | null)?.favorite_genres) ?? []
        const theirGenres = profileRow.favorite_genres ?? []
        if (myGenres.length > 0 && theirGenres.length > 0) {
          const overlap = theirGenres.filter((g) => myGenres.includes(g)).length
          const union = new Set([...myGenres, ...theirGenres]).size || 1
          setTasteMatch(Math.round((overlap / union) * 100))
        }
        const mine = new Set(((myFinishedRes.data ?? []) as Array<{ book_id: string }>).map((r) => r.book_id))
        const theirs = ((theirFinishedRes.data ?? []) as Array<{ book_id: string }>).map((r) => r.book_id)
        let common = 0
        for (const b of theirs) if (mine.has(b)) common += 1
        setBooksInCommon(common)
      } catch {
        /* ignore, show no taste match */
      }
    }

    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Refresh follower count after a Follow/Unfollow tap so the header stat
  // updates without a hard reload.
  const handleFollowChange = useCallback((nowFollowing: boolean) => {
    setCounts((c) => ({ ...c, followers: c.followers + (nowFollowing ? 1 : -1) }))
  }, [])

  const initial = (profile?.display_name || profile?.username || '?')[0]?.toUpperCase() ?? '?'
  const isSelf = !!viewerId && viewerId === id

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary, marginLeft: 4 }}
        >
          Profile
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color={colors.brandUi} />
          </View>
        ) : notFound || !profile ? (
          <View className="py-12 items-center px-8">
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 14,
                color: colors.textTertiary,
                textAlign: 'center',
              }}
            >
              We couldn't find that reader.
            </Text>
          </View>
        ) : (
          <>
            <View className="items-center mb-6">
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  overflow: 'hidden',
                  backgroundColor: colors.brandSubtle,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: colors.borderSubtle,
                }}
              >
                {profile.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <Text
                    style={{ fontFamily: Fonts.display, fontSize: 30, color: colors.brandSubtleText }}
                  >
                    {initial}
                  </Text>
                )}
              </View>

              <Text
                style={{
                  fontFamily: Fonts.displayBold,
                  fontSize: 22,
                  color: colors.textPrimary,
                  marginTop: 14,
                }}
              >
                {profile.display_name ?? 'Reader'}
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.mono,
                  fontSize: 13,
                  color: colors.textTertiary,
                  marginTop: 2,
                }}
              >
                @{profile.username ?? 'reader'}
              </Text>
              {profile.bio ? (
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginTop: 10,
                    textAlign: 'center',
                    lineHeight: 20,
                    paddingHorizontal: 16,
                  }}
                >
                  {profile.bio}
                </Text>
              ) : null}

              {!isSelf && (tasteMatch !== null || booksInCommon > 0) ? (
                <View
                  className="flex-row items-center px-3 py-1 rounded-full"
                  style={{ backgroundColor: colors.bgSelected, marginTop: 10, gap: 8 }}
                >
                  {tasteMatch !== null ? (
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 11,
                        color: colors.brandText,
                      }}
                    >
                      {tasteMatch}% taste match
                    </Text>
                  ) : null}
                  {booksInCommon > 0 ? (
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 11,
                        color: colors.brandText,
                      }}
                    >
                      · {booksInCommon} in common
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {!isSelf ? (
                <View style={{ marginTop: 14 }}>
                  <FollowButton targetUserId={profile.id} onChange={handleFollowChange} />
                </View>
              ) : null}
            </View>

            <View
              className="flex-row mb-6 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              style={{ paddingVertical: 14 }}
            >
              <StatTile value={counts.booksRead} label="Books" />
              <Divider />
              <StatTile
                value={counts.following}
                label="Following"
                onPress={() => router.push(`/follows?userId=${profile.id}&tab=following` as never)}
              />
              <Divider />
              <StatTile
                value={counts.followers}
                label="Followers"
                onPress={() => router.push(`/follows?userId=${profile.id}&tab=followers` as never)}
              />
            </View>

            {reading?.book ? (
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontFamily: Fonts.display,
                    fontSize: 16,
                    color: colors.textPrimary,
                    marginBottom: 10,
                  }}
                >
                  Currently Reading
                </Text>
                <View
                  className="flex-row rounded-2xl p-3 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <View
                    style={{
                      width: 56,
                      height: 84,
                      borderRadius: 6,
                      overflow: 'hidden',
                      backgroundColor: colors.bgSunken,
                      marginRight: 12,
                    }}
                  >
                    {reading.book.cover_url ? (
                      <Image
                        source={{ uri: reading.book.cover_url }}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <BookOpen color={colors.textTertiary} size={20} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 15,
                        color: colors.textPrimary,
                      }}
                      numberOfLines={2}
                    >
                      {reading.book.title}
                    </Text>
                    <Text
                      style={{
                        fontFamily: Fonts.ui,
                        fontSize: 12,
                        color: colors.textTertiary,
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {reading.book.author}
                    </Text>
                    <View
                      style={{
                        marginTop: 10,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: colors.bgSunken,
                      }}
                    >
                      <View
                        style={{
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: colors.brandUi,
                          width: `${pct(reading.progress_percentage ?? 0)}%`,
                        }}
                      />
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Reading Timeline link, visible for self only (privacy). */}
            {isSelf ? (
              <Pressable
                onPress={() => router.push('/reading-timeline' as never)}
                className="flex-row items-center justify-between p-3 mb-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              >
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 14,
                    color: colors.textPrimary,
                  }}
                >
                  Reading Timeline
                </Text>
                <Text
                  style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}
                >
                  Open →
                </Text>
              </Pressable>
            ) : null}

            {publicCommonplace.length > 0 ? (
              <View style={{ marginBottom: 18 }}>
                <View className="flex-row items-center justify-between" style={{ marginBottom: 10 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 11,
                      color: colors.textTertiary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                    }}
                  >
                    From their saved passages
                  </Text>
                  {isSelf ? (
                    <Pressable
                      onPress={() => router.push('/saved-passages' as never)}
                      hitSlop={6}
                    >
                      <Text
                        style={{
                          fontFamily: Fonts.uiMedium,
                          fontSize: 11,
                          color: colors.brandText,
                        }}
                      >
                        View all
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {publicCommonplace.map((e) => (
                  <View
                    key={e.id}
                    className="p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.bodyItalic,
                        fontSize: 13,
                        color: colors.textPrimary,
                        lineHeight: 19,
                      }}
                      numberOfLines={4}
                    >
                      "{e.passage_text}"
                    </Text>
                    {e.book ? (
                      <Text
                        style={{
                          fontFamily: Fonts.ui,
                          fontSize: 11,
                          color: colors.textTertiary,
                          marginTop: 6,
                        }}
                        numberOfLines={1}
                      >
                        {e.book.title}{e.book.author ? ` · ${e.book.author}` : ''}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {publicClubs.length > 0 ? (
              <View style={{ marginBottom: 18 }}>
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 11,
                    color: colors.textTertiary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    marginBottom: 10,
                  }}
                >
                  In these clubs
                </Text>
                {publicClubs.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/clubs/${c.id}` as never)}
                    className="flex-row items-center p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: Fonts.uiMedium,
                        fontSize: 14,
                        color: colors.textPrimary,
                      }}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.textTertiary }}>
                      {c.member_count} members
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatTile({
  value,
  label,
  onPress,
}: {
  value: number
  label: string
  onPress?: () => void
}) {
  const colors = useColors()
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}
    >
      <Text style={{ fontFamily: Fonts.displayBold, fontSize: 20, color: colors.textPrimary }}>
        {formatStat(value)}
      </Text>
      <Text
        style={{
          fontFamily: Fonts.ui,
          fontSize: 11,
          color: colors.textTertiary,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function Divider() {
  const colors = useColors()
  return <View style={{ width: 1, backgroundColor: colors.borderSubtle, marginVertical: 4 }} />
}

function pct(p: number): number {
  return Math.max(0, Math.min(100, Math.round((p ?? 0) * 100)))
}

function formatStat(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}
