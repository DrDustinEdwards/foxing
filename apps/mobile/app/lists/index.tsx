import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { CaretLeft, Plus, Eye, EyeSlash, Globe } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface ListRow {
  id: string
  title: string
  description: string | null
  is_public: boolean
  like_count: number | null
  book_count: number
}

export default function MyListsScreen() {
  const colors = useColors()
  const router = useRouter()
  const [rows, setRows] = useState<ListRow[]>([])
  const [loading, setLoading] = useState(true)

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
    const { data: lists } = await supabase
      .from('reading_lists')
      .select('id, title, description, is_public, like_count')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    const listRows =
      ((lists ?? []) as Array<{
        id: string
        title: string
        description: string | null
        is_public: boolean
        like_count: number | null
      }>)
    const ids = listRows.map((l) => l.id)
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
    setRows(
      listRows.map((l) => ({
        ...l,
        book_count: counts.get(l.id) ?? 0,
      })),
    )
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
          My lists
        </Text>
        <Pressable
          onPress={() => router.push('/lists/public' as never)}
          hitSlop={10}
          className="p-2"
        >
          <Globe color={colors.textSecondary} size={20} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/lists/new' as never)}
          hitSlop={10}
          className="p-2"
        >
          <Plus color={colors.brandUi} size={22} weight="bold" />
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textTertiary,
              textAlign: 'center',
            }}
          >
            No lists yet. Create one to start curating.
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
              <View
                className="flex-row items-center"
                style={{ gap: 8, marginBottom: 4 }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontFamily: Fonts.uiMedium,
                    fontSize: 15,
                    color: colors.textPrimary,
                  }}
                  numberOfLines={1}
                >
                  {l.title}
                </Text>
                {l.is_public ? (
                  <Eye color={colors.info} size={14} />
                ) : (
                  <EyeSlash color={colors.textTertiary} size={14} />
                )}
              </View>
              {l.description ? (
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginBottom: 6,
                  }}
                  numberOfLines={1}
                >
                  {l.description}
                </Text>
              ) : null}
              <Text
                style={{
                  fontFamily: Fonts.mono,
                  fontSize: 11,
                  color: colors.textTertiary,
                }}
              >
                {l.book_count} book{l.book_count === 1 ? '' : 's'}
                {l.is_public && (l.like_count ?? 0) > 0
                  ? ` · ${l.like_count} like${l.like_count === 1 ? '' : 's'}`
                  : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
