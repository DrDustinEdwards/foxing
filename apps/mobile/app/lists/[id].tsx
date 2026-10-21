import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import {
  CaretLeft,
  Plus,
  Trash,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  PencilSimple,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { pickOne } from '@/lib/pick-one'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { ListLikeButton } from '@/components/lists/list-like-button'

interface ListInfo {
  id: string
  user_id: string
  title: string
  description: string | null
  is_public: boolean
  like_count: number | null
}

interface ListBookRow {
  id: string
  position: number | null
  note: string | null
  book: {
    id: string
    title: string
    author: string
    cover_url: string | null
  } | null
}

export default function ListDetailScreen() {
  const colors = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [info, setInfo] = useState<ListInfo | null>(null)
  const [books, setBooks] = useState<ListBookRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPublic, setEditPublic] = useState(false)
  const [adding, setAdding] = useState(false)
  const [bookQuery, setBookQuery] = useState('')
  const [bookResults, setBookResults] = useState<
    Array<{ id: string; title: string; author: string; cover_url: string | null }>
  >([])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)
    const { data: listData } = await supabase
      .from('reading_lists')
      .select('id, user_id, title, description, is_public, like_count')
      .eq('id', id)
      .maybeSingle()
    if (!listData) {
      setLoading(false)
      return
    }
    const list = listData as ListInfo
    setInfo(list)
    setEditTitle(list.title)
    setEditDescription(list.description ?? '')
    setEditPublic(list.is_public)

    const { data: bookData } = await supabase
      .from('reading_list_books')
      .select(
        'id, position, note, book:book_id(id, title, author, cover_url)',
      )
      .eq('list_id', id)
      .order('position', { ascending: true, nullsFirst: false })
    const raw = ((bookData ?? []) as unknown) as Array<Record<string, unknown>>
    setBooks(
      raw.map((r) => ({
        id: String(r.id),
        position: (r.position as number | null) ?? null,
        note: (r.note as string | null) ?? null,
        book: pickOne(r.book),
      })),
    )
    setLoading(false)
  }, [id])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )
  useEffect(() => {
    void load()
  }, [load])

  const searchBooks = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setBookResults([])
      return
    }
    const { data } = await supabase
      .from('books')
      .select('id, title, author, cover_url')
      .ilike('title', `%${q.trim()}%`)
      .limit(10)
    setBookResults(
      ((data ?? []) as Array<{
        id: string
        title: string
        author: string
        cover_url: string | null
      }>),
    )
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void searchBooks(bookQuery), 250)
    return () => clearTimeout(t)
  }, [bookQuery, searchBooks])

  async function addBook(bookId: string) {
    if (!info) return
    const { error } = await supabase
      .from('reading_list_books')
      .insert({
        list_id: info.id,
        book_id: bookId,
        position: books.length,
      })
    if (error) {
      Alert.alert('Could not add', error.message)
      return
    }
    setBookQuery('')
    setBookResults([])
    setAdding(false)
    void load()
  }

  async function removeBook(rowId: string) {
    Alert.alert('Remove book?', 'It stays in your library.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('reading_list_books').delete().eq('id', rowId)
          setBooks((prev) => prev.filter((b) => b.id !== rowId))
        },
      },
    ])
  }

  async function saveEdit() {
    if (!info) return
    const { error } = await supabase
      .from('reading_lists')
      .update({
        title: editTitle.trim().slice(0, 80) || info.title,
        description: editDescription.trim() || null,
        is_public: editPublic,
      })
      .eq('id', info.id)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    setEditing(false)
    void load()
  }

  async function deleteList() {
    if (!info) return
    Alert.alert('Delete list?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('reading_lists').delete().eq('id', info.id)
          router.back()
        },
      },
    ])
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }
  if (!info) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark px-8">
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 14,
            color: colors.textTertiary,
            textAlign: 'center',
          }}
        >
          List not found.
        </Text>
      </SafeAreaView>
    )
  }

  const isOwn = info.user_id === userId

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
          numberOfLines={1}
        >
          {info.title}
        </Text>
        {isOwn ? (
          <Pressable
            onPress={() => setEditing(true)}
            hitSlop={10}
            className="p-2"
          >
            <PencilSimple color={colors.textSecondary} size={20} />
          </Pressable>
        ) : (
          <ListLikeButton
            listId={info.id}
            initialCount={info.like_count ?? 0}
            ownerId={info.user_id}
          />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {info.description ? (
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textSecondary,
              marginBottom: 8,
            }}
          >
            {info.description}
          </Text>
        ) : null}
        <View
          className="flex-row items-center"
          style={{ gap: 8, marginBottom: 16 }}
        >
          <Text
            style={{
              fontFamily: Fonts.mono,
              fontSize: 11,
              color: colors.textTertiary,
            }}
          >
            {books.length} book{books.length === 1 ? '' : 's'}
            {info.is_public && (info.like_count ?? 0) > 0
              ? ` · ${info.like_count} like${info.like_count === 1 ? '' : 's'}`
              : ''}
          </Text>
          {info.is_public ? (
            <Eye color={colors.info} size={14} />
          ) : (
            <EyeSlash color={colors.textTertiary} size={14} />
          )}
        </View>

        {isOwn ? (
          <Pressable
            onPress={() => setAdding(true)}
            className="flex-row items-center justify-center p-3 mb-4 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            style={{ gap: 6 }}
          >
            <Plus color={colors.brandUi} size={18} weight="bold" />
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 13,
                color: colors.brandText,
              }}
            >
              Add a book
            </Text>
          </Pressable>
        ) : null}

        {books.map((b) => (
          <View
            key={b.id}
            className="flex-row p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <Pressable
              onPress={() => {
                if (b.book?.id) router.push(`/book/${b.book.id}` as never)
              }}
              style={{
                width: 48,
                height: 72,
                borderRadius: 4,
                overflow: 'hidden',
                backgroundColor: colors.bgSunken,
              }}
            >
              {b.book?.cover_url ? (
                <Image
                  source={{ uri: b.book.cover_url }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : null}
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 14,
                  color: colors.textPrimary,
                }}
                numberOfLines={2}
              >
                {b.book?.title ?? 'Unknown'}
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
                {b.book?.author ?? ''}
              </Text>
              {b.note ? (
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginTop: 4,
                  }}
                  numberOfLines={3}
                >
                  {b.note}
                </Text>
              ) : null}
            </View>
            {isOwn ? (
              <Pressable
                onPress={() => removeBook(b.id)}
                hitSlop={10}
                style={{ padding: 4 }}
              >
                <Trash color={colors.textTertiary} size={16} />
              </Pressable>
            ) : null}
          </View>
        ))}

        {isOwn ? (
          <Pressable
            onPress={deleteList}
            style={{
              marginTop: 24,
              padding: 12,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 13,
                color: colors.error,
              }}
            >
              Delete list
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={adding}
        animationType="slide"
        onRequestClose={() => setAdding(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
          <View className="flex-row items-center px-3 py-2">
            <Pressable
              onPress={() => setAdding(false)}
              hitSlop={10}
              className="p-2"
            >
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
              Add a book
            </Text>
          </View>
          <View
            className="mx-4 mb-2 flex-row items-center rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            style={{ paddingHorizontal: 12 }}
          >
            <MagnifyingGlass color={colors.textTertiary} size={18} />
            <TextInput
              value={bookQuery}
              onChangeText={setBookQuery}
              placeholder="Search books..."
              placeholderTextColor={colors.textTertiary}
              autoFocus
              style={{
                flex: 1,
                fontFamily: Fonts.body,
                fontSize: 14,
                color: colors.textPrimary,
                paddingVertical: 10,
                marginLeft: 8,
              }}
            />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {bookResults.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => void addBook(b.id)}
                className="flex-row p-2 mb-2 rounded-lg"
              >
                <View
                  style={{
                    width: 40,
                    height: 60,
                    borderRadius: 4,
                    overflow: 'hidden',
                    backgroundColor: colors.bgSunken,
                  }}
                >
                  {b.cover_url ? (
                    <Image
                      source={{ uri: b.cover_url }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : null}
                </View>
                <View
                  style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 14,
                      color: colors.textPrimary,
                    }}
                    numberOfLines={1}
                  >
                    {b.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 12,
                      color: colors.textTertiary,
                    }}
                    numberOfLines={1}
                  >
                    {b.author}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={editing}
        animationType="slide"
        onRequestClose={() => setEditing(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
          <View className="flex-row items-center px-3 py-2">
            <Pressable
              onPress={() => setEditing(false)}
              hitSlop={10}
              className="p-2"
            >
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
              Edit list
            </Text>
            <Pressable
              onPress={saveEdit}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.brandUi,
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
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Title"
              placeholderTextColor={colors.textTertiary}
              maxLength={80}
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 16,
                color: colors.textPrimary,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 12,
              }}
            />
            <TextInput
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Description"
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={500}
              style={{
                fontFamily: Fonts.body,
                fontSize: 14,
                color: colors.textPrimary,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
            <Pressable
              onPress={() => setEditPublic((v) => !v)}
              className="flex-row items-center gap-3 p-3 rounded-xl border border-border-subtle-light dark:border-border-subtle-dark"
            >
              {editPublic ? (
                <Eye color={colors.info} size={18} />
              ) : (
                <EyeSlash color={colors.textTertiary} size={18} />
              )}
              <Text
                style={{
                  fontFamily: Fonts.body,
                  fontSize: 14,
                  color: colors.textPrimary,
                }}
              >
                {editPublic ? 'Public list' : 'Private to you'}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}
