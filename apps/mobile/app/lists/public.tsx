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
import { CaretLeft, BookmarkSimple, User } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { ListLikeButton } from '@/components/lists/list-like-button'

interface PublicListRow {
  id: string
  title: string
  description: string | null
  like_count: number | null
  user_id: string
  book_count: number
  author: {
    display_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

export default function PublicListsScreen() {
  const colors = useColors()
  const router = useRouter()
  const [rows, setRows] = useState<PublicListRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('reading_lists')
      .select(
        'id, title, description, like_count, user_id, author:user_id(display_name, username, avatar_url)',
      )
      .eq('is_public', true)
      .order('like_count', { ascending: false, nullsFirst: false })
      .limit(50)
    const rawRows = ((data ?? []) as unknown) as Array<Record<string, unknown>>
    const ids = rawRows.map((r) => String(r.id))
    const counts = new Map<string, number>()
    if (ids.length > 0) {
      const { data: books } = await supabase
        .from('reading_list_books')
        .select('list_id')
        .in('list_id', ids)
      for (const b of (books as { list_id: string }[] | null) ?? []) {
        counts.set(b.list_id, (counts.get(b.list_id) ?? 0) + 1)
      }
    }
    const normalized: PublicListRow[] = rawRows.map((r) => {
      const author = Array.isArray(r.author)
        ? (r.author[0] as PublicListRow['author']) ?? null
        : (r.author as PublicListRow['author']) ?? null
      return {
        id: String(r.id),
        title: String(r.title),
        description: (r.description as string | null) ?? null,
        like_count: (r.like_count as number | null) ?? 0,
        user_id: String(r.user_id),
        book_count: counts.get(String(r.id)) ?? 0,
        author,
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
          }}
        >
          Public lists
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
            No public lists yet.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {rows.map((l) => (
            <Pressable
              key={l.id}
              onPress={() => router.push(`/lists/${l.id}` as never)}
              className="p-4 mb-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 15,
                  color: colors.textPrimary,
                  marginBottom: 4,
                }}
                numberOfLines={1}
              >
                {l.title}
              </Text>
              <View
                className="flex-row items-center"
                style={{ gap: 6, marginBottom: 6 }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    overflow: 'hidden',
                    backgroundColor: colors.brandSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {l.author?.avatar_url ? (
                    <Image
                      source={{ uri: l.author.avatar_url }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <User color={colors.brandSubtleText} size={10} />
                  )}
                </View>
                <Text
                  style={{
                    fontFamily: Fonts.ui,
                    fontSize: 11,
                    color: colors.textTertiary,
                  }}
                  numberOfLines={1}
                >
                  {l.author?.display_name ?? l.author?.username ?? 'Reader'}
                </Text>
              </View>
              {l.description ? (
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginBottom: 6,
                  }}
                  numberOfLines={2}
                >
                  {l.description}
                </Text>
              ) : null}
              <View
                className="flex-row items-center justify-between"
                style={{ marginTop: 4 }}
              >
                <Text
                  style={{
                    fontFamily: Fonts.mono,
                    fontSize: 11,
                    color: colors.textTertiary,
                  }}
                >
                  {l.book_count} book{l.book_count === 1 ? '' : 's'}
                </Text>
                <ListLikeButton
                  listId={l.id}
                  initialCount={l.like_count ?? 0}
                  ownerId={l.user_id}
                />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
