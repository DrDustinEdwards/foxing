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
import { useFocusEffect, useRouter } from 'expo-router'
import { CaretLeft, BookOpen, Plus, Sparkle } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/feed'

interface BuddyReadRow {
  id: string
  book_id: string
  user1_id: string
  user2_id: string
  started_at: string
  is_active: boolean
  book: {
    title: string
    cover_url: string | null
    slug: string | null
    author: string
  } | null
  partner: {
    id: string
    display_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
  post_count: number
}

function pickOne<T>(v: unknown): T | null {
  if (!v) return null
  if (Array.isArray(v)) return (v[0] as T | undefined) ?? null
  return v as T
}

export default function BuddyReadsIndex() {
  const colors = useColors()
  const router = useRouter()
  const [rows, setRows] = useState<BuddyReadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isPlus, setIsPlus] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setRows([])
      setLoading(false)
      return
    }
    const [profileRes, brRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('buddy_reads')
        .select(
          'id, book_id, user1_id, user2_id, started_at, is_active, book:book_id(title, cover_url, slug, author), user1:user1_id(id, display_name, username, avatar_url), user2:user2_id(id, display_name, username, avatar_url)',
        )
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('is_active', { ascending: false })
        .order('started_at', { ascending: false }),
    ])
    const tier =
      (profileRes.data as { subscription_tier: string | null } | null)
        ?.subscription_tier ?? 'free'
    setIsPlus(tier === 'plus')

    const raw = ((brRes.data ?? []) as unknown) as Array<Record<string, unknown>>
    const ids = raw.map((r) => String(r.id))
    const counts = new Map<string, number>()
    if (ids.length > 0) {
      const { data: postRows } = await supabase
        .from('buddy_read_posts')
        .select('buddy_read_id')
        .in('buddy_read_id', ids)
      for (const p of (postRows as { buddy_read_id: string }[] | null) ?? []) {
        counts.set(p.buddy_read_id, (counts.get(p.buddy_read_id) ?? 0) + 1)
      }
    }

    const normalized: BuddyReadRow[] = raw.map((r) => {
      const u1 = pickOne<{
        id: string
        display_name: string | null
        username: string | null
        avatar_url: string | null
      }>(r.user1)
      const u2 = pickOne<{
        id: string
        display_name: string | null
        username: string | null
        avatar_url: string | null
      }>(r.user2)
      const partner = u1?.id === user.id ? u2 : u1
      return {
        id: String(r.id),
        book_id: String(r.book_id),
        user1_id: String(r.user1_id),
        user2_id: String(r.user2_id),
        started_at: String(r.started_at),
        is_active: Boolean(r.is_active),
        book: pickOne(r.book),
        partner,
        post_count: counts.get(String(r.id)) ?? 0,
      }
    })
    setRows(normalized)
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )
  useEffect(() => {
    void load()
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
            flex: 1,
          }}
        >
          Buddy reads
        </Text>
        {isPlus ? (
          <Pressable
            onPress={() => router.push('/buddy-reads/invite' as never)}
            hitSlop={10}
            className="p-2"
          >
            <Plus color={colors.brandUi} size={22} weight="bold" />
          </Pressable>
        ) : null}
      </View>

      {!isPlus ? (
        <View
          className="mx-4 mb-2 flex-row items-center gap-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          style={{ padding: 14 }}
        >
          <Sparkle color={colors.brandUi} size={24} weight="fill" />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 13,
                color: colors.textPrimary,
              }}
            >
              Plus unlocks buddy reads
            </Text>
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 12,
                color: colors.textTertiary,
                marginTop: 2,
              }}
            >
              Read a book one-on-one with another reader.
            </Text>
          </View>
        </View>
      ) : null}

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
            No buddy reads yet. Start one with a friend.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {rows.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/buddy-reads/${r.id}` as never)}
              className="flex-row p-3 mb-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <View
                style={{
                  width: 48,
                  height: 72,
                  borderRadius: 6,
                  overflow: 'hidden',
                  backgroundColor: colors.bgSunken,
                }}
              >
                {r.book?.cover_url ? (
                  <Image
                    source={{ uri: r.book.cover_url }}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : null}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 14,
                    color: colors.textPrimary,
                  }}
                  numberOfLines={1}
                >
                  {r.book?.title ?? 'Untitled'}
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
                  {r.book?.author ?? ''}
                </Text>
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 12,
                    color: colors.brandText,
                    marginTop: 6,
                  }}
                >
                  Reading with{' '}
                  {r.partner?.display_name ?? r.partner?.username ?? 'Reader'}
                </Text>
                <Text
                  style={{
                    fontFamily: Fonts.mono,
                    fontSize: 11,
                    color: colors.textTertiary,
                    marginTop: 2,
                  }}
                >
                  {r.is_active ? 'Active' : 'Finished'} · {r.post_count} post
                  {r.post_count === 1 ? '' : 's'} · started{' '}
                  {relativeTime(r.started_at)}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
