import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import {
  PencilSimple,
  SignOut,
  BookOpen,
  Camera,
  CaretRight,
  GearSix,
  Plus,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  EditProfileSheet,
  pickAndUploadAvatar,
  type EditableProfile,
} from '@/components/profile/edit-profile-sheet'
import { badgeIcon } from '@/lib/badges'
import { refreshReadingPersonality } from '@/lib/recommendations'
import { PickFavoritesSheet } from '@/components/profile/pick-favorites-sheet'

interface CurrentlyReading {
  id: string
  progress_percentage: number
  book: { id: string; title: string; author: string; cover_url: string | null }
}

interface BadgeEntry {
  earned_at: string
  badge: { slug: string; name: string; category: string | null } | null
}

interface RecentHighlight {
  id: string
  text: string
  color: string | null
  created_at: string
  book: { id: string; title: string; author: string } | null
}

interface Stats {
  booksRead: number
  highlights: number
  following: number
  followers: number
  yearBooks: number
  allTimeBooks: number
  currentStreak: number
  longestStreak: number
  avgWpm: number | null
}

const EMPTY_STATS: Stats = {
  booksRead: 0,
  highlights: 0,
  following: 0,
  followers: 0,
  yearBooks: 0,
  allTimeBooks: 0,
  currentStreak: 0,
  longestStreak: 0,
  avgWpm: null,
}

export default function ProfileScreen() {
  const colors = useColors()
  const router = useRouter()
  const [profile, setProfile] = useState<EditableProfile | null>(null)
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [currentlyReading, setCurrentlyReading] = useState<CurrentlyReading | null>(null)
  const [badges, setBadges] = useState<BadgeEntry[]>([])
  const [recentHighlights, setRecentHighlights] = useState<RecentHighlight[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [personality, setPersonality] = useState<string | null>(null)
  const [personalityBusy, setPersonalityBusy] = useState(false)
  // Five favorite books, one row per position (1..5). Position is the slot
  // in the profile grid; book may be null if a slot is empty.
  const [favorites, setFavorites] = useState<
    Array<{ position: number; book: { id: string; title: string; author: string; cover_url: string | null } | null }>
  >([])
  const [favoritePickPos, setFavoritePickPos] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const uid = user.id
    const yearStart = `${new Date().getFullYear()}-01-01T00:00:00Z`

    const [
      profileRes,
      finishedRes,
      yearFinishedRes,
      currentRes,
      highlightCountRes,
      recentHighlightsRes,
      followersRes,
      followingRes,
      streakRes,
      sessionsRes,
      badgesRes,
      favoritesRes,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, bio, favorite_genres, reading_personality')
        .eq('id', uid)
        .single(),
      supabase
        .from('user_books')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('status', 'finished'),
      supabase
        .from('user_books')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('status', 'finished')
        .gte('finished_at', yearStart),
      supabase
        .from('user_books')
        .select('id, progress_percentage, started_at, book:books(id, title, author, cover_url)')
        .eq('user_id', uid)
        .eq('status', 'reading')
        .order('started_at', { ascending: false, nullsFirst: false })
        .limit(1),
      supabase
        .from('highlights')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid),
      supabase
        .from('highlights')
        .select('id, text, color, created_at, book:books(id, title, author)')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('following_id', uid),
      supabase
        .from('follows')
        .select('following_id', { count: 'exact', head: true })
        .eq('follower_id', uid),
      supabase
        .from('reading_streaks')
        .select('current_streak, longest_streak, total_books_finished')
        .eq('user_id', uid)
        .maybeSingle(),
      supabase
        .from('reading_sessions')
        .select('avg_wpm, started_at')
        .eq('user_id', uid),
      supabase
        .from('user_badges')
        .select('earned_at, badge:badges(slug, name, category)')
        .eq('user_id', uid)
        .order('earned_at', { ascending: false }),
      supabase
        .from('user_favorites')
        .select('position, book:books(id, title, author, cover_url)')
        .eq('user_id', uid)
        .order('position', { ascending: true }),
    ])

    if (profileRes.error) {
      setError(profileRes.error.message)
    } else if (profileRes.data) {
      setProfile(profileRes.data as EditableProfile)
      const pers = (profileRes.data as { reading_personality?: string | null }).reading_personality
      setPersonality(pers ?? null)
    }

    const sessions = (sessionsRes.data ?? []) as Array<{ avg_wpm: number | null; started_at: string }>
    const wpmSamples = sessions.map((s) => s.avg_wpm).filter((v): v is number => typeof v === 'number' && v > 0)
    const avgWpm = wpmSamples.length
      ? Math.round(wpmSamples.reduce((a, b) => a + b, 0) / wpmSamples.length)
      : null

    const streakRow = streakRes.data as
      | { current_streak: number | null; longest_streak: number | null; total_books_finished: number | null }
      | null

    // Fall back to deriving streaks from session dates if the streak table
    // doesn't have a row yet (e.g. early account, before a tracker job ran).
    const fallback = streakRow ? null : deriveStreaks(sessions.map((s) => s.started_at))

    setStats({
      booksRead: finishedRes.count ?? 0,
      highlights: highlightCountRes.count ?? 0,
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
      yearBooks: yearFinishedRes.count ?? 0,
      allTimeBooks: streakRow?.total_books_finished ?? finishedRes.count ?? 0,
      currentStreak: streakRow?.current_streak ?? fallback?.current ?? 0,
      longestStreak: streakRow?.longest_streak ?? fallback?.longest ?? 0,
      avgWpm,
    })

    const reading = (currentRes.data?.[0] as unknown) as CurrentlyReading | undefined
    setCurrentlyReading(reading ?? null)

    setRecentHighlights((recentHighlightsRes.data as unknown as RecentHighlight[]) ?? [])
    setBadges((badgesRes.data as unknown as BadgeEntry[]) ?? [])

    // Normalize favorites into 5 slots (1..5). Empty slots stay null so the
    // grid can render dashed placeholders for them.
    type FR = {
      position: number
      book:
        | { id: string; title: string; author: string; cover_url: string | null }
        | Array<{ id: string; title: string; author: string; cover_url: string | null }>
        | null
    }
    const rows = ((favoritesRes.data ?? []) as unknown) as FR[]
    const byPos = new Map<number, FR['book']>()
    for (const r of rows) byPos.set(r.position, r.book)
    setFavorites(
      [1, 2, 3, 4, 5].map((position) => {
        const raw = byPos.get(position) ?? null
        const book = Array.isArray(raw) ? raw[0] ?? null : raw
        return { position, book }
      }),
    )
    setLoading(false)
  }, [])

  const onPickFavorite = useCallback(
    async (bookId: string) => {
      if (favoritePickPos === null || !profile) return
      await supabase
        .from('user_favorites')
        .upsert(
          { user_id: profile.id, book_id: bookId, position: favoritePickPos },
          { onConflict: 'user_id,position' },
        )
      setFavoritePickPos(null)
      load()
    },
    [favoritePickPos, load, profile],
  )

  const onRemoveFavorite = useCallback(
    async (position: number) => {
      if (!profile) return
      await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', profile.id)
        .eq('position', position)
      load()
    },
    [load, profile],
  )

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  useEffect(() => {
    load()
  }, [load])

  const handleAvatarTap = useCallback(async () => {
    if (!profile) return
    try {
      setAvatarBusy(true)
      const url = await pickAndUploadAvatar(profile.id)
      if (url) setProfile({ ...profile, avatar_url: url })
    } catch (e: any) {
      setError(e?.message ?? 'Avatar upload failed')
    } finally {
      setAvatarBusy(false)
    }
  }, [profile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const refreshPersonality = useCallback(async () => {
    if (!profile?.id || personalityBusy) return
    setPersonalityBusy(true)
    try {
      const next = await refreshReadingPersonality(profile.id)
      if (next) setPersonality(next)
    } finally {
      setPersonalityBusy(false)
    }
  }, [personalityBusy, profile?.id])

  const initial = (profile?.display_name || profile?.username || '?')[0]?.toUpperCase() ?? '?'

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center justify-end px-3 pt-2">
        <Pressable
          onPress={() => router.push('/settings' as never)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          style={{ padding: 6 }}
        >
          <GearSix color={colors.textPrimary} size={22} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Header */}
        <View className="items-center mt-2 mb-6">
          <Pressable
            onPress={handleAvatarTap}
            disabled={avatarBusy}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            accessibilityState={avatarBusy ? { busy: true } : undefined}
          >
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
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={{ width: '100%', height: '100%' }}
                  accessibilityRole="image"
                  accessibilityLabel="Your profile photo"
                />
              ) : (
                <Text style={{ fontFamily: Fonts.display, fontSize: 30, color: colors.brandSubtleText }}>
                  {initial}
                </Text>
              )}
              {avatarBusy ? (
                <View
                  style={{
                    position: 'absolute',
                    inset: 0 as any,
                    backgroundColor: colors.overlay,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator color={colors.textOnBrand} />
                </View>
              ) : null}
            </View>
            <View
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: colors.brandUi,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: colors.bgBase,
              }}
            >
              <Camera color={colors.textOnBrand} size={14} />
            </View>
          </Pressable>

          <Text
            style={{
              fontFamily: Fonts.displayBold,
              fontSize: 22,
              color: colors.textPrimary,
              marginTop: 14,
            }}
          >
            {profile?.display_name ?? 'Reader'}
          </Text>
          <Text
            style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}
          >
            @{profile?.username ?? 'reader'}
          </Text>
          {profile?.bio ? (
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

          <Pressable
            onPress={() => setEditing(true)}
            disabled={!profile}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            accessibilityState={!profile ? { disabled: true } : undefined}
            className="mt-4 flex-row items-center gap-2 px-4 py-2 rounded-full border border-border-interactive-light dark:border-border-interactive-dark bg-bg-surface-light dark:bg-bg-surface-dark"
          >
            <PencilSimple color={colors.textPrimary} size={14} />
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
              Edit Profile
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brandUi} />
        ) : (
          <>
            {/* 5 Favorite Books grid, the identity section. Tap an empty
                slot to pick from finished books; tap a filled slot to
                replace or remove. */}
            <View style={{ marginBottom: 16 }}>
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
                My 5 books
              </Text>
              <View className="flex-row" style={{ gap: 8 }}>
                {favorites.map((slot) => {
                  const filled = !!slot.book
                  return (
                    <Pressable
                      key={slot.position}
                      onPress={() => {
                        if (filled) {
                          Alert.alert(slot.book!.title, undefined, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Replace', onPress: () => setFavoritePickPos(slot.position) },
                            {
                              text: 'Remove',
                              style: 'destructive',
                              onPress: () => onRemoveFavorite(slot.position),
                            },
                          ])
                        } else {
                          setFavoritePickPos(slot.position)
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        filled
                          ? `Favorite ${slot.position}: ${slot.book!.title}`
                          : `Empty favorite slot ${slot.position}`
                      }
                      style={{
                        width: 56,
                        height: 84,
                        borderRadius: 6,
                        overflow: 'hidden',
                        borderWidth: filled ? 0 : 1.5,
                        borderColor: colors.borderBrand,
                        borderStyle: filled ? 'solid' : 'dashed',
                        backgroundColor: filled ? colors.bgSunken : colors.brandSubtle,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {filled && slot.book?.cover_url ? (
                        <Image
                          source={{ uri: slot.book.cover_url }}
                          style={{ width: '100%', height: '100%' }}
                          accessibilityRole="image"
                          accessibilityLabel={`${slot.book.title} cover`}
                        />
                      ) : filled ? (
                        <Text
                          style={{
                            fontFamily: Fonts.display,
                            fontSize: 10,
                            color: colors.textTertiary,
                            textAlign: 'center',
                            paddingHorizontal: 4,
                          }}
                          numberOfLines={3}
                        >
                          {slot.book?.title}
                        </Text>
                      ) : (
                        <Plus color={colors.brandUi} size={18} weight="bold" />
                      )}
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Stats row */}
            <View
              className="flex-row mb-6 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              style={{ paddingVertical: 14 }}
            >
              <StatTile
                value={stats.booksRead}
                label="Books"
                onPress={() => router.push('/(tabs)/library')}
              />
              <Divider />
              <StatTile
                value={stats.highlights}
                label="Highlights"
                onPress={() => router.push('/highlights' as never)}
              />
              <Divider />
              <StatTile
                value={stats.following}
                label="Following"
                onPress={() => router.push('/follows?tab=following' as never)}
              />
              <Divider />
              <StatTile
                value={stats.followers}
                label="Followers"
                onPress={() => router.push('/follows?tab=followers' as never)}
              />
            </View>

            {/* Reading personality */}
            <View
              style={{
                marginBottom: 24,
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.brandSubtle,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 11,
                    color: colors.brandSubtleText,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  Reading Personality
                </Text>
                <Pressable
                  onPress={refreshPersonality}
                  disabled={personalityBusy}
                  hitSlop={8}
                >
                  {personalityBusy ? (
                    <ActivityIndicator color={colors.brandSubtleText} size="small" />
                  ) : (
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 11,
                        color: colors.brandSubtleText,
                      }}
                    >
                      {personality ? 'Refresh' : 'Generate'}
                    </Text>
                  )}
                </Pressable>
              </View>
              <Text
                style={{
                  fontFamily: Fonts.body,
                  fontSize: 14,
                  color: colors.brandSubtleText,
                  lineHeight: 20,
                }}
              >
                {personality ?? 'Finish a few books and your reading personality will appear here.'}
              </Text>
            </View>

            {/* Currently reading */}
            {currentlyReading?.book ? (
              <Section title="Currently Reading">
                <Pressable
                  onPress={() => router.push(`/reader/${currentlyReading.book.id}`)}
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
                    {currentlyReading.book.cover_url ? (
                      <Image
                        source={{ uri: currentlyReading.book.cover_url }}
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
                      style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}
                      numberOfLines={2}
                    >
                      {currentlyReading.book.title}
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
                      {currentlyReading.book.author}
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
                          width: `${pct(currentlyReading.progress_percentage)}%`,
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        fontFamily: Fonts.mono,
                        fontSize: 11,
                        color: colors.textTertiary,
                        marginTop: 4,
                      }}
                    >
                      {pct(currentlyReading.progress_percentage)}%
                    </Text>
                  </View>
                </Pressable>
              </Section>
            ) : null}

            {/* Quick links, one-row horizontal scroll for screens that
                don't have a top-level home elsewhere. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginBottom: 16 }}
            >
              {[
                { label: 'Genre Bingo', href: '/genre-bingo' },
                { label: 'Saved Passages', href: '/saved-passages' },
                { label: 'Timeline', href: '/reading-timeline' },
                { label: 'Saved posts', href: '/saved-posts' },
                { label: 'Badges', href: '/badges' },
              ].map((l) => (
                <Pressable
                  key={l.href}
                  onPress={() => router.push(l.href as never)}
                  className="px-3 py-2 rounded-full border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 12,
                      color: colors.textPrimary,
                    }}
                  >
                    {l.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Reading stats card */}
            <Section
              title="Reading Stats"
              actionLabel="View goals"
              onAction={() => router.push('/goals' as never)}
            >
              <View
                className="rounded-2xl p-4 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              >
                <StatBlock heading="This Year">
                  <StatLine value={`${stats.yearBooks}`} label={stats.yearBooks === 1 ? 'book' : 'books'} />
                  <StatLine
                    value={`${stats.currentStreak}`}
                    label={stats.currentStreak === 1 ? 'day streak' : 'day streak'}
                  />
                </StatBlock>
                <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginVertical: 14 }} />
                <StatBlock heading="All Time">
                  <StatLine
                    value={`${stats.allTimeBooks}`}
                    label={stats.allTimeBooks === 1 ? 'book total' : 'books total'}
                  />
                  <StatLine
                    value={`${stats.longestStreak}`}
                    label={stats.longestStreak === 1 ? 'longest day' : 'longest days'}
                  />
                  {stats.avgWpm ? (
                    <StatLine value={`${stats.avgWpm}`} label="avg WPM" />
                  ) : null}
                </StatBlock>
              </View>
            </Section>

            {/* Badges row */}
            {badges.length > 0 ? (
              <Section title="Badges" actionLabel="View all" onAction={() => router.push('/badges' as never)}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 4, paddingRight: 8 }}
                >
                  {badges
                    .filter((b) => b.badge)
                    .map((b) => {
                      const Icon = badgeIcon(b.badge!.slug)
                      return (
                        <View
                          key={b.badge!.slug}
                          style={{
                            width: 84,
                            alignItems: 'center',
                            marginRight: 8,
                          }}
                        >
                          <View
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: 28,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: colors.brandSubtle,
                              borderWidth: 1,
                              borderColor: colors.borderSubtle,
                            }}
                          >
                            <Icon color={colors.brandSubtleText} size={28} weight="regular" />
                          </View>
                          <Text
                            style={{
                              fontFamily: Fonts.uiMedium,
                              fontSize: 11,
                              color: colors.textSecondary,
                              marginTop: 6,
                              textAlign: 'center',
                            }}
                            numberOfLines={2}
                          >
                            {b.badge!.name}
                          </Text>
                        </View>
                      )
                    })}
                </ScrollView>
              </Section>
            ) : null}

            {/* Recent highlights */}
            {recentHighlights.length > 0 ? (
              <Section
                title="Recent Highlights"
                actionLabel="View all"
                onAction={() => router.push('/highlights' as never)}
              >
                {recentHighlights.map((h) => (
                  <View
                    key={h.id}
                    className="mb-2 rounded-2xl p-3 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.body,
                        fontSize: 14,
                        color: colors.textPrimary,
                        lineHeight: 21,
                      }}
                      numberOfLines={3}
                    >
                      “{h.text}”
                    </Text>
                    {h.book ? (
                      <Text
                        style={{
                          fontFamily: Fonts.ui,
                          fontSize: 11,
                          color: colors.textTertiary,
                          marginTop: 6,
                        }}
                        numberOfLines={1}
                      >
                        {h.book.title} · {h.book.author}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </Section>
            ) : null}

            {error ? (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.errorBg,
                  marginBottom: 16,
                }}
              >
                <Text style={{ flex: 1, fontFamily: Fonts.ui, fontSize: 13, color: colors.error }}>
                  {error}
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out of Foxing"
              className="flex-row justify-center items-center gap-2 rounded-xl py-4 border border-border-subtle-light dark:border-border-subtle-dark bg-bg-surface-light dark:bg-bg-surface-dark"
            >
              <SignOut color={colors.error} size={16} />
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.error }}>Sign out</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {profile ? (
        <EditProfileSheet
          visible={editing}
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            load()
          }}
        />
      ) : null}

      <PickFavoritesSheet
        visible={favoritePickPos !== null}
        position={favoritePickPos}
        onPick={onPickFavorite}
        onClose={() => setFavoritePickPos(null)}
      />
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
      <Text
        style={{
          fontFamily: Fonts.displayBold,
          fontSize: 20,
          color: colors.textPrimary,
        }}
      >
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

function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
  children: React.ReactNode
}) {
  const colors = useColors()
  return (
    <View style={{ marginBottom: 24 }}>
      <View className="flex-row items-center justify-between mb-3">
        <Text style={{ fontFamily: Fonts.display, fontSize: 16, color: colors.textPrimary }}>
          {title}
        </Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} className="flex-row items-center gap-1">
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}>
              {actionLabel}
            </Text>
            <CaretRight color={colors.brandText} size={12} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  )
}

function StatBlock({ heading, children }: { heading: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 6,
        }}
      >
        {heading}
      </Text>
      <View className="flex-row flex-wrap" style={{ marginHorizontal: -8 }}>
        {children}
      </View>
    </View>
  )
}

function StatLine({ value, label }: { value: string; label: string }) {
  const colors = useColors()
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, minWidth: '33%' }}>
      <Text style={{ fontFamily: Fonts.displayBold, fontSize: 18, color: colors.brandText }}>
        {value}
      </Text>
      <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>
        {label}
      </Text>
    </View>
  )
}

function pct(p: number): number {
  return Math.max(0, Math.min(100, Math.round((p ?? 0) * 100)))
}

function formatStat(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

function deriveStreaks(timestamps: string[]): { current: number; longest: number } {
  const days = Array.from(
    new Set(
      timestamps.filter(Boolean).map((ts) => new Date(ts).toISOString().slice(0, 10))
    )
  ).sort()
  if (days.length === 0) return { current: 0, longest: 0 }

  // Longest run of consecutive UTC days.
  let longest = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + 'T00:00:00Z').getTime()
    const cur = new Date(days[i] + 'T00:00:00Z').getTime()
    if (cur - prev === 86_400_000) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 1
    }
  }

  // Current streak walks back from today.
  const daySet = new Set(days)
  let current = 0
  const cursor = new Date()
  while (true) {
    const key = cursor.toISOString().slice(0, 10)
    if (daySet.has(key)) {
      current += 1
      cursor.setUTCDate(cursor.getUTCDate() - 1)
    } else {
      break
    }
  }
  return { current, longest }
}
