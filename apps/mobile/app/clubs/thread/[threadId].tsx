import { useClubLive, useCreatePost, useRemovePost, useThreadPage } from '@foxing/client'
import type * as W from '@foxing/types'
import { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput, Switch, Alert } from 'react-native'
import { KeyboardStickyView } from 'react-native-keyboard-controller'
import { Screen } from '@/components/ui/screen'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft, Sparkle, ChatCircleDots, PaperPlaneRight } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { authClient } from '@/lib/api'
import { PostCard } from '@/components/clubs/post-card'

// A club thread: GET /threads/:id, kept fresh by the club's live socket while you
// are a member, so new posts appear without a reload.
export default function ThreadScreen() {
  const colors = useColors()
  const router = useRouter()
  const { threadId } = useLocalSearchParams<{ threadId: string }>()
  const session = authClient.useSession()
  const viewerId = session.data?.user.id ?? null
  const threadPage = useThreadPage(threadId ?? '')
  const page = threadPage.data
  useClubLive(page?.isMember ? page.club.id : null)
  const createPost = useCreatePost()
  const removePost = useRemovePost()
  const posting = createPost.pending
  const [body, setBody] = useState('')
  const [hasSpoilers, setHasSpoilers] = useState(false)
  const [replyTo, setReplyTo] = useState<W.ClubPostItem | null>(null)
  // Per-post reveal state for spoiler bodies. Defaults to hidden.
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const scrollRef = useRef<ScrollView>(null)

  // Arrange posts: top-level first, then nest direct replies under each.
  // We only render ONE level of nesting to keep the layout sane.
  const grouped = useMemo(() => {
    const posts = page?.posts ?? []
    const topLevel = posts.filter((p) => !p.parentPostId)
    const childrenByParent = new Map<string, W.ClubPostItem[]>()
    for (const p of posts) {
      if (p.parentPostId) {
        const list = childrenByParent.get(p.parentPostId) ?? []
        list.push(p)
        childrenByParent.set(p.parentPostId, list)
      }
    }
    return topLevel.map((p) => ({ post: p, replies: childrenByParent.get(p.id) ?? [] }))
  }, [page?.posts])

  const send = useCallback(async () => {
    if (!threadId || !body.trim() || posting) return
    const ok = await createPost.run({
      threadId,
      parentPostId: replyTo?.id,
      content: body.trim(),
      hasSpoiler: hasSpoilers,
    })
    if (ok) {
      setBody('')
      setHasSpoilers(false)
      setReplyTo(null)
      // Scroll to end so the user sees their own post; small timeout lets
      // the new layout pass settle.
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)
    }
  }, [body, createPost, hasSpoilers, posting, replyTo, threadId])

  // Long-press your own post to delete it.
  const openPostActions = useCallback(
    (post: W.ClubPostItem) => {
      if (!threadId || !viewerId || post.author?.id !== viewerId) return
      Alert.alert('Delete this post?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removePost.fire({ threadId, postId: post.id }) },
      ])
    },
    [removePost, threadId, viewerId],
  )

  const toggleReveal = useCallback((postId: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }, [])

  if (threadPage.isPending) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator color={colors.brandUi} />
      </Screen>
    )
  }
  if (!page) {
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

  const thread = page.thread
  const canPost = page.isMember

  return (
    <Screen>
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 4 }}>
          <View className="flex-row items-center gap-1">
            {thread.isAiStarter ? (
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
                  canReply={canPost}
                  onToggleReveal={() => toggleReveal(post.id)}
                  onReply={() => setReplyTo(post)}
                  onOpenAuthor={(username) => router.push(`/u/${username}` as never)}
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
                        canReply={false}
                        onToggleReveal={() => toggleReveal(r.id)}
                        onOpenAuthor={(username) => router.push(`/u/${username}` as never)}
                        onLongPress={() => openPostActions(r)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>

        {canPost ? (
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
                  Replying to {replyTo.author?.displayName ?? replyTo.author?.username ?? 'reader'}
                </Text>
                <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                  <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandText }}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {createPost.error ? (
              <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.error, marginBottom: 6 }}>
                {createPost.error}
              </Text>
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
