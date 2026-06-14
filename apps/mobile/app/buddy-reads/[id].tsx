import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native'
import { KeyboardStickyView } from 'react-native-keyboard-controller'
import { Screen } from '@/components/ui/screen'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  CaretLeft,
  Eye,
  EyeSlash,
  PaperPlaneTilt,
  CheckCircle,
  Trash,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/feed'

interface BuddyReadInfo {
  id: string
  book_id: string
  user1_id: string
  user2_id: string
  is_active: boolean
  book: {
    title: string
    cover_url: string | null
    author: string
  } | null
  partner: {
    display_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

interface PostRow {
  id: string
  author_id: string
  content: string
  page_number: number | null
  chapter: string | null
  has_spoiler: boolean
  created_at: string
  author: {
    display_name: string | null
    avatar_url: string | null
  } | null
}

function pickOne<T>(v: unknown): T | null {
  if (!v) return null
  if (Array.isArray(v)) return (v[0] as T | undefined) ?? null
  return v as T
}

export default function BuddyReadConversation() {
  const colors = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [userId, setUserId] = useState<string | null>(null)
  const [info, setInfo] = useState<BuddyReadInfo | null>(null)
  const [posts, setPosts] = useState<PostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [pageNumber, setPageNumber] = useState('')
  const [chapter, setChapter] = useState('')
  const [hasSpoiler, setHasSpoiler] = useState(false)
  const [posting, setPosting] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setUserId(user.id)
    const { data: brData } = await supabase
      .from('buddy_reads')
      .select(
        'id, book_id, user1_id, user2_id, is_active, book:book_id(title, cover_url, author), user1:user1_id(display_name, username, avatar_url), user2:user2_id(display_name, username, avatar_url)',
      )
      .eq('id', id)
      .maybeSingle()
    if (!brData) {
      setLoading(false)
      return
    }
    const row = brData as unknown as {
      id: string
      book_id: string
      user1_id: string
      user2_id: string
      is_active: boolean
      book: unknown
      user1: unknown
      user2: unknown
    }
    const u1 = pickOne<{
      display_name: string | null
      username: string | null
      avatar_url: string | null
    }>(row.user1)
    const u2 = pickOne<{
      display_name: string | null
      username: string | null
      avatar_url: string | null
    }>(row.user2)
    const partner = row.user1_id === user.id ? u2 : u1
    setInfo({
      id: row.id,
      book_id: row.book_id,
      user1_id: row.user1_id,
      user2_id: row.user2_id,
      is_active: row.is_active,
      book: pickOne(row.book),
      partner,
    })

    const { data: postData } = await supabase
      .from('buddy_read_posts')
      .select(
        'id, author_id, content, page_number, chapter, has_spoiler, created_at, author:author_id(display_name, avatar_url)',
      )
      .eq('buddy_read_id', id)
      .order('created_at', { ascending: true })
    const postsNorm: PostRow[] = ((postData ?? []) as unknown as Array<
      Record<string, unknown>
    >).map((p) => ({
      id: String(p.id),
      author_id: String(p.author_id),
      content: String(p.content ?? ''),
      page_number: (p.page_number as number | null) ?? null,
      chapter: (p.chapter as string | null) ?? null,
      has_spoiler: Boolean(p.has_spoiler),
      created_at: String(p.created_at),
      author: pickOne(p.author),
    }))
    setPosts(postsNorm)
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function submitPost() {
    if (!userId || !id) return
    const text = content.trim()
    if (!text) return
    setPosting(true)
    const pageNum = pageNumber.trim()
      ? Number(pageNumber.replace(/[^0-9]/g, ''))
      : null
    const { error } = await supabase.from('buddy_read_posts').insert({
      buddy_read_id: id,
      author_id: userId,
      content: text.slice(0, 5000),
      page_number: Number.isFinite(pageNum) ? pageNum : null,
      chapter: chapter.trim() || null,
      has_spoiler: hasSpoiler,
    })
    setPosting(false)
    if (error) {
      Alert.alert('Could not post', error.message)
      return
    }
    setContent('')
    setPageNumber('')
    setChapter('')
    setHasSpoiler(false)
    void load()
  }

  async function deletePost(postId: string) {
    if (!userId) return
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('buddy_read_posts')
            .delete()
            .eq('id', postId)
            .eq('author_id', userId)
          setPosts((prev) => prev.filter((p) => p.id !== postId))
        },
      },
    ])
  }

  async function markFinished() {
    if (!info) return
    Alert.alert('Mark as finished?', 'You can still view the conversation.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark finished',
        onPress: async () => {
          const { error } = await supabase
            .from('buddy_reads')
            .update({ is_active: false })
            .eq('id', info.id)
          if (error) {
            Alert.alert('Could not update', error.message)
            return
          }
          setInfo({ ...info, is_active: false })
        },
      },
    ])
  }

  if (loading) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator color={colors.brandUi} />
      </Screen>
    )
  }
  if (!info) {
    return (
      <Screen className="items-center justify-center px-8">
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 14,
            color: colors.textTertiary,
            textAlign: 'center',
          }}
        >
          Buddy read not found.
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
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 14,
                color: colors.textPrimary,
              }}
              numberOfLines={1}
            >
              {info.book?.title ?? 'Buddy read'}
            </Text>
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 11,
                color: colors.textTertiary,
              }}
              numberOfLines={1}
            >
              with{' '}
              {info.partner?.display_name ??
                info.partner?.username ??
                'Reader'}
            </Text>
          </View>
          {info.is_active ? (
            <Pressable onPress={markFinished} hitSlop={10} className="p-2">
              <CheckCircle color={colors.textTertiary} size={22} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
        >
          {posts.length === 0 ? (
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 14,
                color: colors.textTertiary,
                textAlign: 'center',
                marginTop: 24,
              }}
            >
              Be the first to post.
            </Text>
          ) : (
            posts.map((p) => {
              const isOwn = p.author_id === userId
              const isHidden = p.has_spoiler && !revealed.has(p.id) && !isOwn
              return (
                <View
                  key={p.id}
                  className="p-3 mb-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        overflow: 'hidden',
                        backgroundColor: colors.brandSubtle,
                      }}
                    >
                      {p.author?.avatar_url ? (
                        <Image
                          source={{ uri: p.author.avatar_url }}
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
                    >
                      {p.author?.display_name ?? 'Reader'}
                    </Text>
                    <Text
                      style={{
                        fontFamily: Fonts.mono,
                        fontSize: 10,
                        color: colors.textTertiary,
                      }}
                    >
                      {relativeTime(p.created_at)}
                    </Text>
                  </View>
                  <View
                    className="flex-row flex-wrap"
                    style={{ gap: 6, marginTop: 6 }}
                  >
                    {p.page_number !== null ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: colors.bgSunken,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: Fonts.mono,
                            fontSize: 11,
                            color: colors.textTertiary,
                          }}
                        >
                          p. {p.page_number}
                        </Text>
                      </View>
                    ) : null}
                    {p.chapter ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: colors.bgSunken,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: Fonts.mono,
                            fontSize: 11,
                            color: colors.textTertiary,
                          }}
                        >
                          {p.chapter}
                        </Text>
                      </View>
                    ) : null}
                    {p.has_spoiler ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: colors.brandSubtle,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: Fonts.mono,
                            fontSize: 11,
                            color: colors.brandSubtleText,
                          }}
                        >
                          Spoiler
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {isHidden ? (
                    <Pressable
                      onPress={() =>
                        setRevealed((prev) => new Set(prev).add(p.id))
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
                      {p.content}
                    </Text>
                  )}
                  {isOwn ? (
                    <Pressable
                      onPress={() => deletePost(p.id)}
                      hitSlop={10}
                      style={{ alignSelf: 'flex-end', marginTop: 6 }}
                    >
                      <Trash color={colors.textTertiary} size={14} />
                    </Pressable>
                  ) : null}
                </View>
              )
            })
          )}
        </ScrollView>

        {info.is_active ? (
          <KeyboardStickyView>
          <View
            style={{
              padding: 12,
              borderTopWidth: 1,
              borderTopColor: colors.borderSubtle,
              backgroundColor: colors.bgSurface,
            }}
          >
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Share a thought..."
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={5000}
              style={{
                fontFamily: Fonts.body,
                fontSize: 14,
                color: colors.textPrimary,
                backgroundColor: colors.bgBase,
                borderColor: colors.borderSubtle,
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                minHeight: 40,
                textAlignVertical: 'top',
              }}
            />
            <View
              className="flex-row items-center"
              style={{ gap: 8, marginTop: 8 }}
            >
              <TextInput
                value={pageNumber}
                onChangeText={(t) => setPageNumber(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="Page"
                placeholderTextColor={colors.textTertiary}
                style={{
                  width: 64,
                  fontFamily: Fonts.body,
                  fontSize: 13,
                  color: colors.textPrimary,
                  backgroundColor: colors.bgBase,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                }}
              />
              <TextInput
                value={chapter}
                onChangeText={setChapter}
                placeholder="Chapter"
                placeholderTextColor={colors.textTertiary}
                style={{
                  flex: 1,
                  fontFamily: Fonts.body,
                  fontSize: 13,
                  color: colors.textPrimary,
                  backgroundColor: colors.bgBase,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                }}
              />
              <Pressable
                onPress={() => setHasSpoiler((v) => !v)}
                hitSlop={6}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: hasSpoiler ? colors.brandUi : colors.borderSubtle,
                  backgroundColor: hasSpoiler
                    ? colors.brandSubtle
                    : colors.bgBase,
                }}
              >
                {hasSpoiler ? (
                  <EyeSlash color={colors.brandSubtleText} size={16} />
                ) : (
                  <Eye color={colors.textTertiary} size={16} />
                )}
              </Pressable>
              <Pressable
                onPress={submitPost}
                disabled={posting || !content.trim()}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: content.trim()
                    ? colors.brandUi
                    : colors.bgDisabled,
                }}
              >
                <PaperPlaneTilt color={colors.textOnBrand} size={18} />
              </Pressable>
            </View>
          </View>
          </KeyboardStickyView>
        ) : null}
    </Screen>
  )
}
