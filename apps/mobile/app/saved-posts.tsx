import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, BookmarkSimple } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/feed'

// Unwrap a Supabase relation that may come back as an object, an array, or null.
function pickOne(v: unknown): Record<string, unknown> | null {
  if (!v) return null
  if (Array.isArray(v)) return (v[0] as Record<string, unknown> | undefined) ?? null
  if (typeof v === 'object') return v as Record<string, unknown>
  return null
}

interface SavedRow {
  post_id: string
  saved_at: string
  post: {
    id: string
    body: string
    created_at: string
    thread_id: string
    thread: { id: string; title: string; club_id: string } | null
    author: { display_name: string | null; username: string | null } | null
  } | null
}

export default function SavedPostsScreen() {
  const colors = useColors()
  const router = useRouter()
  const [rows, setRows] = useState<SavedRow[]>([])
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
      .from('saved_posts')
      .select(
        'post_id, saved_at, post:club_posts!post_id(id, body, created_at, thread_id, thread:club_threads!thread_id(id, title, club_id), author:profiles!user_id(display_name, username))',
      )
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
    // Supabase relation types vary across client versions; normalize via
    // any-shaped intermediate to avoid wrestling with the generated types.
    const normalized: SavedRow[] = ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
      const post = pickOne(r.post)
      if (!post) return { post_id: String(r.post_id), saved_at: String(r.saved_at), post: null }
      const thread = pickOne(post.thread)
      const author = pickOne(post.author)
      return {
        post_id: String(r.post_id),
        saved_at: String(r.saved_at),
        post: {
          id: String(post.id ?? ''),
          body: String(post.body ?? ''),
          created_at: String(post.created_at ?? ''),
          thread_id: String(post.thread_id ?? ''),
          thread: thread
            ? {
                id: String(thread.id ?? ''),
                title: String(thread.title ?? ''),
                club_id: String(thread.club_id ?? ''),
              }
            : null,
          author: author
            ? {
                display_name: (author.display_name as string | null) ?? null,
                username: (author.username as string | null) ?? null,
              }
            : null,
        },
      }
    })
    setRows(normalized)
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
          Saved posts
        </Text>
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <BookmarkSimple color={colors.textTertiary} size={28} />
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textTertiary,
              textAlign: 'center',
              marginTop: 12,
            }}
          >
            Long-press a club post to save it for later.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {rows.map((r) => (
            <Pressable
              key={r.post_id}
              onPress={() => {
                if (!r.post?.thread) return
                router.push(
                  `/clubs/${r.post.thread.club_id}/thread/${r.post.thread.id}` as never,
                )
              }}
              className="p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              {r.post?.thread ? (
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 11,
                    color: colors.textTertiary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    marginBottom: 4,
                  }}
                  numberOfLines={1}
                >
                  {r.post.thread.title}
                </Text>
              ) : null}
              <Text
                style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textPrimary, lineHeight: 21 }}
                numberOfLines={4}
              >
                {r.post?.body ?? '(post unavailable)'}
              </Text>
              <Text
                style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 6 }}
              >
                {r.post?.author?.display_name ?? r.post?.author?.username ?? 'Reader'}
                {r.post?.created_at ? ` · ${relativeTime(r.post.created_at)}` : ''}
                {' · saved '}
                {relativeTime(r.saved_at)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
