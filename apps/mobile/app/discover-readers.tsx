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
import { useRouter } from 'expo-router'
import { CaretLeft, UsersThree } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { FollowButton } from '@/components/profile/follow-button'

interface CandidateRow {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  favorite_genres: string[] | null
  // Set by caller for "Readers like you", overlap-based.
  compatibility?: number | null
  booksInCommon?: number
  // Suggestions ("followed by people I follow"), count of intersecting followers.
  mutualFollows?: number
}

export default function DiscoverReadersScreen() {
  const colors = useColors()
  const router = useRouter()
  const [tasteMatches, setTasteMatches] = useState<CandidateRow[]>([])
  const [suggested, setSuggested] = useState<CandidateRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setTasteMatches([])
      setSuggested([])
      setLoading(false)
      return
    }
    const uid = user.id

    // Get my profile (genres + finished books) and my follows in parallel.
    const [meRes, followsRes, myBooksRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, favorite_genres')
        .eq('id', uid)
        .maybeSingle(),
      supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', uid),
      supabase
        .from('user_books')
        .select('book_id')
        .eq('user_id', uid)
        .eq('status', 'finished'),
    ])
    const myGenres = ((meRes.data as { favorite_genres: string[] | null } | null)?.favorite_genres) ?? []
    const myFollowing = new Set(
      ((followsRes.data ?? []) as Array<{ following_id: string }>).map((r) => r.following_id),
    )
    const myBookIds = new Set(
      ((myBooksRes.data ?? []) as Array<{ book_id: string }>).map((r) => r.book_id),
    )

    // ── Readers like you ──────────────────────────────────────────────────
    // Public profiles with overlapping favorite_genres. Compute overlap %
    // and books-in-common count from the user_books finished set.
    let tasteRows: CandidateRow[] = []
    if (myGenres.length > 0) {
      // Postgrest overlap operator on text[] is `&&` via .overlaps().
      const { data: cands } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, favorite_genres')
        .overlaps('favorite_genres', myGenres)
        .neq('id', uid)
        .limit(30)
      const ids = ((cands ?? []) as CandidateRow[]).map((r) => r.id)
      // Pull finished-book ids for the candidates in bulk so we can count
      // overlap with the viewer's reads.
      const { data: theirBooks } = ids.length
        ? await supabase
            .from('user_books')
            .select('user_id, book_id')
            .in('user_id', ids)
            .eq('status', 'finished')
        : { data: [] }
      const booksByUser = new Map<string, Set<string>>()
      for (const r of (theirBooks ?? []) as Array<{ user_id: string; book_id: string }>) {
        if (!booksByUser.has(r.user_id)) booksByUser.set(r.user_id, new Set())
        booksByUser.get(r.user_id)!.add(r.book_id)
      }
      tasteRows = ((cands ?? []) as CandidateRow[])
        .map((c) => {
          const overlap = (c.favorite_genres ?? []).filter((g) => myGenres.includes(g)).length
          const union = new Set([...myGenres, ...(c.favorite_genres ?? [])]).size || 1
          const compatibility = Math.round((overlap / union) * 100)
          const theirReads = booksByUser.get(c.id) ?? new Set()
          let booksInCommon = 0
          for (const id of myBookIds) if (theirReads.has(id)) booksInCommon += 1
          return { ...c, compatibility, booksInCommon }
        })
        .sort((a, b) => (b.compatibility ?? 0) - (a.compatibility ?? 0))
        .slice(0, 10)
    }

    // ── Suggested follows ─────────────────────────────────────────────────
    // 2nd-degree: anyone followed by someone I follow, that I'm not yet
    // following. Skip self. Score by intersecting follower count.
    let suggestedRows: CandidateRow[] = []
    if (myFollowing.size > 0) {
      const { data: edges } = await supabase
        .from('follows')
        .select('following_id, follower_id')
        .in('follower_id', [...myFollowing])
      const counts = new Map<string, number>()
      for (const e of (edges ?? []) as Array<{ following_id: string; follower_id: string }>) {
        if (e.following_id === uid) continue
        if (myFollowing.has(e.following_id)) continue
        counts.set(e.following_id, (counts.get(e.following_id) ?? 0) + 1)
      }
      const ids = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id)
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url, favorite_genres')
          .in('id', ids)
        suggestedRows = ((profs ?? []) as CandidateRow[]).map((p) => ({
          ...p,
          mutualFollows: counts.get(p.id) ?? 0,
        }))
      }
    }

    setTasteMatches(tasteRows)
    setSuggested(suggestedRows)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

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
          Find Readers
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {tasteMatches.length > 0 ? (
            <Section title="Readers like you">
              {tasteMatches.map((r) => (
                <CandidateCard
                  key={r.id}
                  row={r}
                  meta={
                    `${r.compatibility ?? 0}% taste match` +
                    (r.booksInCommon ? ` · ${r.booksInCommon} books in common` : '')
                  }
                  onOpen={() => router.push(`/user/${r.id}` as never)}
                />
              ))}
            </Section>
          ) : null}
          {suggested.length > 0 ? (
            <Section title="Suggested follows">
              {suggested.map((r) => (
                <CandidateCard
                  key={r.id}
                  row={r}
                  meta={`${r.mutualFollows ?? 0} mutual${r.mutualFollows === 1 ? '' : 's'}`}
                  onOpen={() => router.push(`/user/${r.id}` as never)}
                />
              ))}
            </Section>
          ) : null}
          {tasteMatches.length === 0 && suggested.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <UsersThree color={colors.textTertiary} size={28} />
              <Text
                style={{
                  fontFamily: Fonts.body,
                  fontSize: 14,
                  color: colors.textTertiary,
                  textAlign: 'center',
                  marginTop: 12,
                  paddingHorizontal: 24,
                }}
              >
                Add favorite genres on your profile + follow a few readers so we have something to suggest.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
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
        {title}
      </Text>
      {children}
    </View>
  )
}

function CandidateCard({
  row,
  meta,
  onOpen,
}: {
  row: CandidateRow
  meta: string
  onOpen: () => void
}) {
  const colors = useColors()
  const initial = (row.display_name ?? row.username ?? '?')[0]?.toUpperCase() ?? '?'
  return (
    <View
      className="flex-row items-center p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <Pressable onPress={onOpen} hitSlop={4}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            overflow: 'hidden',
            backgroundColor: colors.brandSubtle,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          {row.avatar_url ? (
            <Image source={{ uri: row.avatar_url }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.brandSubtleText }}>
              {initial}
            </Text>
          )}
        </View>
      </Pressable>
      <Pressable onPress={onOpen} style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
          numberOfLines={1}
        >
          {row.display_name ?? row.username ?? 'Reader'}
        </Text>
        <Text
          style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}
          numberOfLines={1}
        >
          @{row.username ?? 'reader'} · {meta}
        </Text>
      </Pressable>
      <FollowButton targetUserId={row.id} size="sm" />
    </View>
  )
}
