import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Image,
  TextInput,
  Alert,
  Modal,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ChatCircleDots,
  Plus,
  Eye,
  EyeSlash,
  Users,
  Lock,
  CaretLeft,
  Trash,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/feed'

type Visibility = 'public' | 'close_friends' | 'private'

interface CommentRow {
  id: string
  user_id: string
  content: string
  visibility: Visibility
  spoiler_tagged: boolean
  cfi: string | null
  created_at: string
  author: {
    display_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
  reply_count: number
}

function pickOne<T>(v: unknown): T | null {
  if (!v) return null
  if (Array.isArray(v)) return (v[0] as T | undefined) ?? null
  return v as T
}

interface Props {
  bookId: string
}

export function PassageCommentsSection({ bookId }: Props) {
  const colors = useColors()
  const [rows, setRows] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [activeReply, setActiveReply] = useState<CommentRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)

    const { data } = await supabase
      .from('passage_comments')
      .select(
        'id, user_id, content, visibility, spoiler_tagged, cfi, created_at, author:user_id(display_name, username, avatar_url)',
      )
      .eq('book_id', bookId)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(40)
    const raw = ((data ?? []) as unknown) as Array<Record<string, unknown>>
    const ids = raw.map((r) => String(r.id))
    const counts = new Map<string, number>()
    if (ids.length > 0) {
      const { data: repliesData } = await supabase
        .from('passage_comment_replies')
        .select('comment_id')
        .in('comment_id', ids)
      for (const r of (repliesData as { comment_id: string }[] | null) ?? []) {
        counts.set(r.comment_id, (counts.get(r.comment_id) ?? 0) + 1)
      }
    }
    setRows(
      raw.map((r) => ({
        id: String(r.id),
        user_id: String(r.user_id),
        content: String(r.content ?? ''),
        visibility: (r.visibility as Visibility) ?? 'public',
        spoiler_tagged: Boolean(r.spoiler_tagged),
        cfi: (r.cfi as string | null) ?? null,
        created_at: String(r.created_at),
        author: pickOne(r.author),
        reply_count: counts.get(String(r.id)) ?? 0,
      })),
    )
    setLoading(false)
  }, [bookId])

  useEffect(() => {
    void load()
  }, [load])

  async function deleteComment(id: string) {
    if (!userId) return
    Alert.alert('Delete note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('passage_comments')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)
          setRows((prev) => prev.filter((r) => r.id !== id))
        },
      },
    ])
  }

  return (
    <View style={{ marginTop: 24 }}>
      <View
        className="flex-row items-center justify-between"
        style={{ marginBottom: 10 }}
      >
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          Notes
        </Text>
        {userId ? (
          <Pressable onPress={() => setComposing(true)} hitSlop={10}>
            <Plus color={colors.brandUi} size={18} weight="bold" />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brandUi} />
      ) : rows.length === 0 ? (
        <View
          className="flex-row items-center p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          style={{ gap: 10 }}
        >
          <ChatCircleDots color={colors.textTertiary} size={20} />
          <Text
            style={{
              flex: 1,
              fontFamily: Fonts.body,
              fontSize: 13,
              color: colors.textTertiary,
            }}
          >
            No notes yet. Add a thought on a passage.
          </Text>
        </View>
      ) : (
        rows.map((c) => {
          const isOwn = c.user_id === userId
          const hidden = c.spoiler_tagged && !revealed.has(c.id) && !isOwn
          return (
            <View
              key={c.id}
              className="p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: colors.brandSubtle,
                  }}
                >
                  {c.author?.avatar_url ? (
                    <Image
                      source={{ uri: c.author.avatar_url }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : null}
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: Fonts.uiMedium,
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                  numberOfLines={1}
                >
                  {c.author?.display_name ?? 'Reader'}
                </Text>
                <Text
                  style={{
                    fontFamily: Fonts.mono,
                    fontSize: 10,
                    color: colors.textTertiary,
                  }}
                >
                  {relativeTime(c.created_at)}
                </Text>
              </View>
              {hidden ? (
                <Pressable
                  onPress={() =>
                    setRevealed((prev) => new Set(prev).add(c.id))
                  }
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: colors.bgSunken,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 12,
                      color: colors.brandText,
                    }}
                  >
                    Reveal spoiler
                  </Text>
                </Pressable>
              ) : (
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 14,
                    color: colors.textPrimary,
                    marginTop: 8,
                    lineHeight: 21,
                  }}
                >
                  {c.content}
                </Text>
              )}
              <View
                className="flex-row items-center"
                style={{ gap: 12, marginTop: 8 }}
              >
                <Pressable
                  onPress={() => setActiveReply(c)}
                  disabled={!userId}
                  hitSlop={6}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 12,
                      color: userId ? colors.brandText : colors.textTertiary,
                    }}
                  >
                    Reply
                    {c.reply_count > 0 ? ` · ${c.reply_count}` : ''}
                  </Text>
                </Pressable>
                {isOwn ? (
                  <Pressable
                    onPress={() => deleteComment(c.id)}
                    hitSlop={6}
                    style={{ marginLeft: 'auto' }}
                  >
                    <Trash color={colors.textTertiary} size={14} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          )
        })
      )}

      <ComposeCommentModal
        visible={composing}
        onClose={() => setComposing(false)}
        bookId={bookId}
        userId={userId}
        onSaved={() => {
          setComposing(false)
          void load()
        }}
      />

      {activeReply ? (
        <ReplyModal
          comment={activeReply}
          onClose={() => setActiveReply(null)}
          userId={userId}
          onSaved={() => {
            setActiveReply(null)
            void load()
          }}
        />
      ) : null}
    </View>
  )
}

function ComposeCommentModal({
  visible,
  onClose,
  bookId,
  userId,
  onSaved,
}: {
  visible: boolean
  onClose: () => void
  bookId: string
  userId: string | null
  onSaved: () => void
}) {
  const colors = useColors()
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [hasSpoiler, setHasSpoiler] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!userId || !content.trim()) return
    setSaving(true)
    const { error } = await supabase.from('passage_comments').insert({
      user_id: userId,
      book_id: bookId,
      content: content.trim().slice(0, 1000),
      visibility,
      spoiler_tagged: hasSpoiler,
    })
    setSaving(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    setContent('')
    setVisibility('public')
    setHasSpoiler(false)
    onSaved()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
        <View className="flex-row items-center px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
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
            Add a note
          </Text>
          <Pressable
            onPress={save}
            disabled={saving || !content.trim()}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: content.trim()
                ? colors.brandUi
                : colors.bgDisabled,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                color: colors.textOnBrand,
                fontSize: 13,
              }}
            >
              Save
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Your note..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={1000}
            style={{
              fontFamily: Fonts.body,
              fontSize: 15,
              color: colors.textPrimary,
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              minHeight: 140,
              textAlignVertical: 'top',
            }}
          />
          <View className="flex-row" style={{ gap: 6 }}>
            {(['public', 'close_friends', 'private'] as Visibility[]).map(
              (v) => {
                const active = visibility === v
                const Icon =
                  v === 'public' ? Eye : v === 'close_friends' ? Users : Lock
                return (
                  <Pressable
                    key={v}
                    onPress={() => setVisibility(v)}
                    className="flex-row items-center"
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? colors.brandUi : colors.borderSubtle,
                      backgroundColor: active
                        ? colors.brandSubtle
                        : colors.bgBase,
                      gap: 6,
                      justifyContent: 'center',
                    }}
                  >
                    <Icon
                      color={
                        active ? colors.brandSubtleText : colors.textSecondary
                      }
                      size={14}
                    />
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 11,
                        color: active
                          ? colors.brandSubtleText
                          : colors.textSecondary,
                        textTransform: 'capitalize',
                      }}
                    >
                      {v.replace('_', ' ')}
                    </Text>
                  </Pressable>
                )
              },
            )}
          </View>
          <Pressable
            onPress={() => setHasSpoiler((v) => !v)}
            className="flex-row items-center gap-3 p-3 rounded-xl border border-border-subtle-light dark:border-border-subtle-dark"
          >
            {hasSpoiler ? (
              <EyeSlash color={colors.brandUi} size={18} />
            ) : (
              <Eye color={colors.textTertiary} size={18} />
            )}
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 14,
                color: colors.textPrimary,
              }}
            >
              {hasSpoiler ? 'Tagged as spoiler' : 'Not a spoiler'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function ReplyModal({
  comment,
  onClose,
  userId,
  onSaved,
}: {
  comment: CommentRow
  onClose: () => void
  userId: string | null
  onSaved: () => void
}) {
  const colors = useColors()
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!userId || !content.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('passage_comment_replies')
      .insert({
        comment_id: comment.id,
        author_id: userId,
        content: content.trim().slice(0, 1000),
      })
    setSaving(false)
    if (error) {
      Alert.alert('Could not reply', error.message)
      return
    }
    setContent('')
    onSaved()
  }

  return (
    <Modal
      visible={true}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
        <View className="flex-row items-center px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
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
            Reply
          </Text>
          <Pressable
            onPress={save}
            disabled={saving || !content.trim()}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: content.trim()
                ? colors.brandUi
                : colors.bgDisabled,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                color: colors.textOnBrand,
                fontSize: 13,
              }}
            >
              Send
            </Text>
          </Pressable>
        </View>
        <View style={{ padding: 16 }}>
          <View
            className="p-3 mb-3 rounded-xl"
            style={{ backgroundColor: colors.bgSunken }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: colors.textTertiary,
                marginBottom: 4,
              }}
            >
              {comment.author?.display_name ?? 'Reader'}
            </Text>
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textSecondary,
              }}
              numberOfLines={3}
            >
              {comment.content}
            </Text>
          </View>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Your reply..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={1000}
            autoFocus
            style={{
              fontFamily: Fonts.body,
              fontSize: 15,
              color: colors.textPrimary,
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              minHeight: 120,
              textAlignVertical: 'top',
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  )
}
