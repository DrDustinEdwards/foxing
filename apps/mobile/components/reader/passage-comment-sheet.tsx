import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  X as XIcon,
  PaperPlaneRight,
  ChatCircleDots,
  Eye,
  EyeSlash,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/feed'
import {
  type PassageComment,
  type PassageCommentReply,
  createComment,
  createReply,
  listCommentsAtCfi,
  toggleCommentReaction,
} from '@/lib/passage-comments'

const REACTION_EMOJI = ['👍', '❤️', '🤔', '😂']

interface ClubChoice {
  club_id: string
  name: string
}

interface PassageCommentSheetProps {
  visible: boolean
  bookId: string
  cfi: string | null
  passageText: string
  clubs: ClubChoice[]
  // The club the new comment will be written to. Defaults to first in `clubs`.
  // Reader screen sets this so the sheet doesn't need its own club picker
  // when the viewer is in just one matching club.
  defaultClubId?: string | null
  onClose: () => void
}

export function PassageCommentSheet({
  visible,
  bookId,
  cfi,
  passageText,
  clubs,
  defaultClubId,
  onClose,
}: PassageCommentSheetProps) {
  const colors = useColors()
  const [comments, setComments] = useState<PassageComment[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [hasSpoilers, setHasSpoilers] = useState(false)
  const [posting, setPosting] = useState(false)
  const [replyTo, setReplyTo] = useState<PassageComment | null>(null)
  // Spoiler reveal is per-comment / per-reply, keyed by id.
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  // When the viewer is in multiple matching clubs, let them pick which
  // club the new comment posts to.
  const [activeClubId, setActiveClubId] = useState<string | null>(null)

  const clubIds = useMemo(() => clubs.map((c) => c.club_id), [clubs])

  // Reset state on open. We deliberately don't reset across visible→hidden→
  // visible cycles so quickly toggling the sheet doesn't churn the list.
  useEffect(() => {
    if (visible) {
      setBody('')
      setHasSpoilers(false)
      setReplyTo(null)
      setRevealed(new Set())
      setActiveClubId(defaultClubId ?? clubs[0]?.club_id ?? null)
    }
  }, [visible, defaultClubId, clubs])

  const load = useCallback(async () => {
    if (!cfi) {
      setComments([])
      setLoading(false)
      return
    }
    setLoading(true)
    const rows = await listCommentsAtCfi({ bookId, clubIds, cfi })
    setComments(rows)
    setLoading(false)
  }, [bookId, cfi, clubIds])

  useEffect(() => {
    if (visible) load()
  }, [visible, load])

  const toggleReveal = useCallback((key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const onReact = useCallback(
    async (commentId: string, emoji: string) => {
      // Optimistic, flip reacted/count on the matching reaction group.
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId) return c
          const groups = c.reactions ?? []
          const exists = groups.find((g) => g.emoji === emoji)
          if (exists) {
            return {
              ...c,
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
            ...c,
            reactions: [...groups, { emoji, count: 1, viewerReacted: true }],
          }
        }),
      )
      const ok = await toggleCommentReaction(commentId, emoji)
      if (!ok) load()
    },
    [load],
  )

  const send = useCallback(async () => {
    if (!body.trim() || posting || !cfi) return
    if (replyTo) {
      setPosting(true)
      const reply = await createReply({
        commentId: replyTo.id,
        body: body.trim(),
        hasSpoilers,
      })
      setPosting(false)
      if (reply) {
        setBody('')
        setReplyTo(null)
        setHasSpoilers(false)
        load()
      }
      return
    }
    if (!activeClubId) return
    setPosting(true)
    const created = await createComment({
      bookId,
      clubId: activeClubId,
      cfi,
      passageText,
      body: body.trim(),
      hasSpoilers,
    })
    setPosting(false)
    if (created) {
      setBody('')
      setHasSpoilers(false)
      load()
    }
  }, [activeClubId, body, bookId, cfi, hasSpoilers, load, passageText, posting, replyTo])

  const canPost = !!activeClubId && !!cfi

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark" edges={['top']}>
        <View className="flex-row items-center justify-between px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
            <XIcon color={colors.textPrimary} size={20} />
          </Pressable>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}>
            Passage discussion
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Passage quote */}
        <View
          className="mx-4 mb-2 p-3 rounded-xl"
          style={{
            backgroundColor: colors.bgSunken,
            borderLeftWidth: 3,
            borderLeftColor: colors.brandUi,
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
            numberOfLines={4}
          >
            “{passageText || 'Selected passage'}”
          </Text>
        </View>

        {/* Club selector, only when the viewer is in 2+ matching clubs */}
        {clubs.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 6 }}
          >
            {clubs.map((c) => {
              const active = c.club_id === activeClubId
              return (
                <Pressable
                  key={c.club_id}
                  onPress={() => setActiveClubId(c.club_id)}
                  className="px-3 py-1 rounded-full border"
                  style={{
                    backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                    borderColor: active ? colors.borderBrand : colors.borderSubtle,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 11,
                      color: active ? colors.brandText : colors.textSecondary,
                    }}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : null}

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}>
            {loading ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <ActivityIndicator color={colors.brandUi} />
              </View>
            ) : comments.length === 0 ? (
              <View style={{ paddingVertical: 32, alignItems: 'center', paddingHorizontal: 24 }}>
                <ChatCircleDots color={colors.textTertiary} size={28} weight="regular" />
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 13,
                    color: colors.textTertiary,
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  Nothing here yet. Be the first to comment.
                </Text>
              </View>
            ) : (
              comments.map((c) => (
                <CommentCard
                  key={c.id}
                  comment={c}
                  revealed={revealed.has(c.id)}
                  onToggleReveal={() => toggleReveal(c.id)}
                  onReact={(emoji) => onReact(c.id, emoji)}
                  onReply={() => setReplyTo(c)}
                  revealedReplies={revealed}
                  onToggleReplyReveal={(rid) => toggleReveal(rid)}
                />
              ))
            )}
          </ScrollView>

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
                  style={{
                    fontFamily: Fonts.ui,
                    fontSize: 11,
                    color: colors.textSecondary,
                    flex: 1,
                  }}
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
                placeholder={
                  !canPost
                    ? 'Select a club above to post'
                    : replyTo
                      ? 'Write a reply…'
                      : 'Share your take on this passage…'
                }
                placeholderTextColor={colors.textTertiary}
                multiline
                editable={canPost}
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
                disabled={!body.trim() || posting || !canPost}
                accessibilityLabel="Send"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    body.trim() && canPost ? colors.brandUi : colors.bgDisabled,
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
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginLeft: 8,
                }}
              >
                Contains spoilers
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

// ── CommentCard ──────────────────────────────────────────────────────────

function CommentCard({
  comment,
  revealed,
  onToggleReveal,
  onReact,
  onReply,
  revealedReplies,
  onToggleReplyReveal,
}: {
  comment: PassageComment
  revealed: boolean
  onToggleReveal: () => void
  onReact: (emoji: string) => void
  onReply: () => void
  revealedReplies: Set<string>
  onToggleReplyReveal: (rid: string) => void
}) {
  const colors = useColors()
  const author = comment.author
  const name = author?.display_name ?? author?.username ?? 'Reader'
  const initial = (name || '?')[0]?.toUpperCase() ?? '?'
  const hidden = comment.has_spoilers && !revealed

  return (
    <View
      className="flex-row p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: colors.brandSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}
      >
        {author?.avatar_url ? (
          <Image source={{ uri: author.avatar_url }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text style={{ fontFamily: Fonts.display, fontSize: 15, color: colors.brandSubtleText }}>
            {initial}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View className="flex-row items-center" style={{ marginBottom: 2 }}>
          <Text
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
            {relativeTime(comment.created_at)}
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
              {comment.body}
            </Text>
            {comment.has_spoilers ? (
              <Pressable onPress={onToggleReveal} className="flex-row items-center gap-1 mt-2">
                <Eye color={colors.textTertiary} size={11} />
                <Text style={{ fontFamily: Fonts.ui, fontSize: 10, color: colors.textTertiary }}>
                  Spoiler shown, tap to hide
                </Text>
              </Pressable>
            ) : null}
          </>
        )}

        {/* Reactions */}
        <View className="flex-row items-center mt-3 gap-1 flex-wrap">
          {REACTION_EMOJI.map((emoji) => {
            const group = comment.reactions?.find((g) => g.emoji === emoji)
            const reacted = !!group?.viewerReacted
            return (
              <Pressable
                key={emoji}
                onPress={() => onReact(emoji)}
                className="flex-row items-center gap-1 px-2 py-1 rounded-full border"
                style={{
                  borderColor: reacted ? colors.borderBrand : colors.borderSubtle,
                  backgroundColor: reacted ? colors.bgSelected : 'transparent',
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
          <Pressable
            onPress={onReply}
            className="flex-row items-center gap-1 px-2 py-1 rounded-full border"
            style={{ borderColor: colors.borderSubtle, marginLeft: 4 }}
          >
            <ChatCircleDots color={colors.textTertiary} size={12} />
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textTertiary }}>
              Reply
            </Text>
          </Pressable>
        </View>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 ? (
          <View style={{ marginTop: 10, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.borderSubtle }}>
            {comment.replies.map((r) => (
              <ReplyRow
                key={r.id}
                reply={r}
                revealed={revealedReplies.has(r.id)}
                onToggleReveal={() => onToggleReplyReveal(r.id)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

function ReplyRow({
  reply,
  revealed,
  onToggleReveal,
}: {
  reply: PassageCommentReply
  revealed: boolean
  onToggleReveal: () => void
}) {
  const colors = useColors()
  const name = reply.author?.display_name ?? reply.author?.username ?? 'Reader'
  const hidden = reply.has_spoilers && !revealed
  return (
    <View style={{ marginBottom: 8 }}>
      <View className="flex-row items-center" style={{ marginBottom: 2 }}>
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 12,
            color: colors.textPrimary,
            marginRight: 6,
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text style={{ fontFamily: Fonts.ui, fontSize: 10, color: colors.textTertiary }}>
          {relativeTime(reply.created_at)}
        </Text>
      </View>
      {hidden ? (
        <Pressable onPress={onToggleReveal}>
          <View
            style={{
              paddingVertical: 8,
              paddingHorizontal: 8,
              borderRadius: 6,
              backgroundColor: colors.bgSelected,
              borderColor: colors.borderBrand,
              borderWidth: 1,
              borderStyle: 'dashed',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <EyeSlash color={colors.brandText} size={12} weight="regular" />
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandText }}>
              Spoiler, tap to reveal
            </Text>
          </View>
        </Pressable>
      ) : (
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 13,
            color: colors.textPrimary,
            lineHeight: 19,
          }}
        >
          {reply.body}
        </Text>
      )}
    </View>
  )
}
