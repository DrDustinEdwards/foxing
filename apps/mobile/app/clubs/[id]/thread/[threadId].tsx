import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
  Switch,
} from 'react-native'
import { KeyboardStickyView } from 'react-native-keyboard-controller'
import { Screen } from '@/components/ui/screen'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  CaretLeft,
  Sparkle,
  Eye,
  EyeSlash,
  ChatCircleDots,
  PaperPlaneRight,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { Alert } from 'react-native'
import {
  type ClubPost,
  type ClubThread,
  createPost,
  fetchPosts,
  fetchThread,
  reportPost,
  savePost,
  toggleReaction,
} from '@/lib/clubs'
import { relativeTime } from '@/lib/feed'

const REACTION_EMOJI = ['👍', '❤️', '🤔', '😂']

export default function ThreadScreen() {
  const colors = useColors()
  const router = useRouter()
  const { id, threadId } = useLocalSearchParams<{ id: string; threadId: string }>()
  const [thread, setThread] = useState<ClubThread | null>(null)
  const [posts, setPosts] = useState<ClubPost[]>([])
  const [loading, setLoading] = useState(true)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [hasSpoilers, setHasSpoilers] = useState(false)
  const [replyTo, setReplyTo] = useState<ClubPost | null>(null)
  const [posting, setPosting] = useState(false)
  // Per-post reveal state for spoiler bodies. Defaults to hidden.
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const scrollRef = useRef<ScrollView>(null)

  const load = useCallback(async () => {
    if (!threadId) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setViewerId(user?.id ?? null)
    const [t, p] = await Promise.all([fetchThread(threadId), fetchPosts(threadId)])
    setThread(t)
    setPosts(p)
    setLoading(false)
  }, [threadId])

  useEffect(() => {
    load()
  }, [load])

  // Realtime: subscribe to new posts and reaction inserts/deletes for this
  // thread. We refetch posts on any event, small enough payloads that the
  // extra round-trip beats stitching individual rows by hand.
  useEffect(() => {
    if (!threadId) return
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'club_posts', filter: `thread_id=eq.${threadId}` },
        () => load(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_post_reactions' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [threadId, load])

  // Arrange posts: top-level first, then nest direct replies under each.
  // We only render ONE level of nesting in v1 to keep the layout sane.
  const grouped = useMemo(() => {
    const topLevel = posts.filter((p) => !p.parent_post_id)
    const childrenByParent = new Map<string, ClubPost[]>()
    for (const p of posts) {
      if (p.parent_post_id) {
        const list = childrenByParent.get(p.parent_post_id) ?? []
        list.push(p)
        childrenByParent.set(p.parent_post_id, list)
      }
    }
    return topLevel.map((p) => ({ post: p, replies: childrenByParent.get(p.id) ?? [] }))
  }, [posts])

  const send = useCallback(async () => {
    if (!threadId || !body.trim() || posting) return
    setPosting(true)
    const newPost = await createPost({
      threadId,
      parentPostId: replyTo?.id ?? null,
      body: body.trim(),
      hasSpoilers,
    })
    setPosting(false)
    if (newPost) {
      setBody('')
      setHasSpoilers(false)
      setReplyTo(null)
      load()
      // Scroll to end so the user sees their own post; small timeout lets
      // the new layout pass settle.
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)
    }
  }, [body, hasSpoilers, load, posting, replyTo, threadId])

  // Long-press a post → action sheet: Save / Report. Skip if not signed in.
  const openPostActions = useCallback(
    (post: ClubPost) => {
      if (!viewerId) return
      Alert.alert('Post actions', undefined, [
        {
          text: 'Save post',
          onPress: async () => {
            const ok = await savePost(post.id)
            if (!ok) console.warn('[thread] save failed')
          },
        },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Report this post', 'Pick a reason.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Spam',
                onPress: async () => {
                  const ok = await reportPost(post.id, 'spam')
                  if (ok) Alert.alert('Report submitted')
                },
              },
              {
                text: 'Harassment',
                onPress: async () => {
                  const ok = await reportPost(post.id, 'harassment')
                  if (ok) Alert.alert('Report submitted')
                },
              },
              {
                text: 'Spoilers without tag',
                onPress: async () => {
                  const ok = await reportPost(post.id, 'spoiler')
                  if (ok) Alert.alert('Report submitted')
                },
              },
              {
                text: 'Offensive content',
                onPress: async () => {
                  const ok = await reportPost(post.id, 'offensive')
                  if (ok) Alert.alert('Report submitted')
                },
              },
              {
                text: 'Other',
                onPress: async () => {
                  const ok = await reportPost(post.id, 'other')
                  if (ok) Alert.alert('Report submitted')
                },
              },
            ])
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ])
    },
    [viewerId],
  )

  const toggleReveal = useCallback((postId: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }, [])

  const onReaction = useCallback(
    async (postId: string, emoji: string) => {
      // Optimistic toggle: flip viewer's reacted/count on the matching post.
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p
          const groups = p.reactions ?? []
          const exists = groups.find((g) => g.emoji === emoji)
          if (exists) {
            return {
              ...p,
              reactions: groups
                .map((g) =>
                  g.emoji === emoji
                    ? {
                        ...g,
                        count: g.count + (g.viewerReacted ? -1 : 1),
                        viewerReacted: !g.viewerReacted,
                      }
                    : g,
                )
                .filter((g) => g.count > 0),
            }
          }
          return {
            ...p,
            reactions: [...groups, { emoji, count: 1, viewerReacted: true }],
          }
        }),
      )
      const ok = await toggleReaction(postId, emoji)
      if (!ok) load()
    },
    [load],
  )

  if (loading) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator color={colors.brandUi} />
      </Screen>
    )
  }
  if (!thread) {
    return (
      <Screen className="items-center justify-center px-8">
        <Text
          style={{
            fontFamily: Fonts.ui,
            fontSize: 14,
            color: colors.textTertiary,
            textAlign: 'center',
          }}
        >
          Thread not found.
        </Text>
      </Screen>
    )
  }

  return (
    <Screen>
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 4 }}>
          <View className="flex-row items-center gap-1">
            {thread.is_ai_starter ? (
              <Sparkle color={colors.brandUi} size={12} weight="regular" />
            ) : null}
            <Text
              numberOfLines={2}
              style={{
                fontFamily: Fonts.displayBold,
                fontSize: 16,
                color: colors.textPrimary,
              }}
            >
              {thread.title}
            </Text>
          </View>
          {thread.chapter ? (
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 11,
                color: colors.textTertiary,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {thread.chapter}
            </Text>
          ) : null}
        </View>
      </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24, paddingTop: 8 }}
        >
          {grouped.length === 0 ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <ChatCircleDots color={colors.textTertiary} size={32} weight="regular" />
              <Text
                style={{
                  fontFamily: Fonts.body,
                  fontSize: 13,
                  color: colors.textTertiary,
                  marginTop: 12,
                }}
              >
                Be the first to reply.
              </Text>
            </View>
          ) : (
            grouped.map(({ post, replies }) => (
              <View key={post.id}>
                <PostCard
                  post={post}
                  revealed={revealed.has(post.id)}
                  viewerId={viewerId}
                  onToggleReveal={() => toggleReveal(post.id)}
                  onReact={(emoji) => onReaction(post.id, emoji)}
                  onReply={() => setReplyTo(post)}
                  onOpenAuthor={(uid) => router.push(`/user/${uid}` as never)}
                  onLongPress={() => openPostActions(post)}
                />
                {replies.length > 0 ? (
                  <View style={{ marginLeft: 24 }}>
                    {replies.map((r) => (
                      <PostCard
                        key={r.id}
                        post={r}
                        nested
                        revealed={revealed.has(r.id)}
                        viewerId={viewerId}
                        onToggleReveal={() => toggleReveal(r.id)}
                        onReact={(emoji) => onReaction(r.id, emoji)}
                        onOpenAuthor={(uid) => router.push(`/user/${uid}` as never)}
                        onLongPress={() => openPostActions(r)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>

        {viewerId ? (
          <KeyboardStickyView>
          <View
            className="border-t border-border-subtle-light dark:border-border-subtle-dark"
            style={{ backgroundColor: colors.bgSurface, padding: 10 }}
          >
            {replyTo ? (
              <View
                className="flex-row items-center justify-between px-2 py-1 mb-2 rounded-md"
                style={{ backgroundColor: colors.bgSelected }}
              >
                <Text
                  style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textSecondary, flex: 1 }}
                  numberOfLines={1}
                >
                  Replying to {replyTo.author?.display_name ?? replyTo.author?.username ?? 'reader'}
                </Text>
                <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                  <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandText }}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <View className="flex-row items-end gap-2">
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={replyTo ? 'Write a reply…' : 'Share your thoughts…'}
                placeholderTextColor={colors.textTertiary}
                multiline
                style={{
                  flex: 1,
                  maxHeight: 140,
                  fontFamily: Fonts.body,
                  fontSize: 15,
                  color: colors.textPrimary,
                  backgroundColor: colors.bgBase,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              />
              <Pressable
                onPress={send}
                disabled={!body.trim() || posting}
                accessibilityLabel="Send"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: body.trim() ? colors.brandUi : colors.bgDisabled,
                  opacity: posting ? 0.7 : 1,
                }}
              >
                {posting ? (
                  <ActivityIndicator color={colors.textOnBrand} size="small" />
                ) : (
                  <PaperPlaneRight color={colors.textOnBrand} size={16} weight="regular" />
                )}
              </Pressable>
            </View>
            <View className="flex-row items-center mt-2">
              <Switch
                value={hasSpoilers}
                onValueChange={setHasSpoilers}
                trackColor={{ false: colors.bgDisabled, true: colors.toggleOn }}
              />
              <Text
                style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textSecondary, marginLeft: 8 }}
              >
                Contains spoilers
              </Text>
            </View>
          </View>
          </KeyboardStickyView>
        ) : null}
    </Screen>
  )
}

// ── PostCard ─────────────────────────────────────────────────────────────

function PostCard({
  post,
  nested,
  revealed,
  viewerId,
  onToggleReveal,
  onReact,
  onReply,
  onOpenAuthor,
  onLongPress,
}: {
  post: ClubPost
  nested?: boolean
  revealed: boolean
  viewerId: string | null
  onToggleReveal: () => void
  onReact: (emoji: string) => void
  onReply?: () => void
  onOpenAuthor: (id: string) => void
  onLongPress?: () => void
}) {
  const colors = useColors()
  const name = post.author?.display_name ?? post.author?.username ?? 'Reader'
  const initial = (name || '?')[0]?.toUpperCase() ?? '?'
  const hidden = post.has_spoiler && !revealed

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={400}
      className="flex-row p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      style={{ opacity: nested ? 0.98 : 1 }}
    >
      <Pressable onPress={() => onOpenAuthor(post.author_id)} hitSlop={4}>
        <View
          style={{
            width: nested ? 32 : 36,
            height: nested ? 32 : 36,
            borderRadius: 18,
            overflow: 'hidden',
            backgroundColor: colors.brandSubtle,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          {post.author?.avatar_url ? (
            <Image
              source={{ uri: post.author.avatar_url }}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <Text
              style={{
                fontFamily: Fonts.display,
                fontSize: nested ? 14 : 15,
                color: colors.brandSubtleText,
              }}
            >
              {initial}
            </Text>
          )}
        </View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <View className="flex-row items-center" style={{ marginBottom: 2 }}>
          <Text
            onPress={() => onOpenAuthor(post.author_id)}
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 13,
              color: colors.textPrimary,
              marginRight: 6,
            }}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>
            {relativeTime(post.created_at)}
          </Text>
        </View>

        {hidden ? (
          <Pressable onPress={onToggleReveal}>
            <View
              style={{
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: colors.bgSelected,
                borderColor: colors.borderBrand,
                borderWidth: 1,
                borderStyle: 'dashed',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <EyeSlash color={colors.brandText} size={14} weight="regular" />
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}>
                Spoiler, tap to reveal
              </Text>
            </View>
          </Pressable>
        ) : (
          <>
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 14,
                color: colors.textPrimary,
                lineHeight: 21,
              }}
            >
              {post.content}
            </Text>
            {post.has_spoiler ? (
              <Pressable
                onPress={onToggleReveal}
                className="flex-row items-center gap-1 mt-2"
              >
                <Eye color={colors.textTertiary} size={11} />
                <Text style={{ fontFamily: Fonts.ui, fontSize: 10, color: colors.textTertiary }}>
                  Spoiler shown, tap to hide
                </Text>
              </Pressable>
            ) : null}
          </>
        )}

        {/* Reaction row */}
        <View className="flex-row items-center mt-3 gap-1 flex-wrap">
          {REACTION_EMOJI.map((emoji) => {
            const group = post.reactions?.find((g) => g.emoji === emoji)
            const reacted = !!group?.viewerReacted
            return (
              <Pressable
                key={emoji}
                onPress={() => onReact(emoji)}
                disabled={!viewerId}
                className="flex-row items-center gap-1 px-2 py-1 rounded-full border"
                style={{
                  borderColor: reacted ? colors.borderBrand : colors.borderSubtle,
                  backgroundColor: reacted ? colors.bgSelected : 'transparent',
                  opacity: viewerId ? 1 : 0.5,
                }}
              >
                <Text style={{ fontSize: 14 }}>{emoji}</Text>
                {group && group.count > 0 ? (
                  <Text
                    style={{
                      fontFamily: Fonts.mono,
                      fontSize: 11,
                      color: reacted ? colors.brandText : colors.textTertiary,
                    }}
                  >
                    {group.count}
                  </Text>
                ) : null}
              </Pressable>
            )
          })}
          {onReply && viewerId && !nested ? (
            <Pressable
              onPress={onReply}
              className="flex-row items-center gap-1 px-2 py-1 rounded-full border"
              style={{ borderColor: colors.borderSubtle, marginLeft: 4 }}
            >
              <ChatCircleDots color={colors.textTertiary} size={12} />
              <Text
                style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textTertiary }}
              >
                Reply
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}
