import { useAddListBook, useDeleteList, useListPage, useRemoveListBook, useSearch, useUpdateList } from '@foxing/client'
import { useState } from 'react'
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
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  CaretLeft,
  Plus,
  Trash,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  PencilSimple,
} from 'phosphor-react-native'
import { authClient } from '@/lib/api'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { ListLikeButton } from '@/components/lists/list-like-button'

// A reading list from GET /lists/:id. Its owner edits, adds and removes books in place;
// everyone else can like it.
export default function ListDetailScreen() {
  const colors = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const listQuery = useListPage(id ?? '')
  const page = listQuery.data
  const signedIn = Boolean(authClient.useSession().data)
  const update = useUpdateList()
  const del = useDeleteList()
  const addBookTo = useAddListBook()
  const removeBookFrom = useRemoveListBook()
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPublic, setEditPublic] = useState(false)
  const [adding, setAdding] = useState(false)
  const [bookQuery, setBookQuery] = useState('')
  const search = useSearch(bookQuery.trim().length >= 2 ? bookQuery : '')
  const bookResults = (search.data?.books ?? []).slice(0, 10)
  const info = page?.list ?? null
  const books = page?.books ?? []
  const loading = listQuery.isPending

  function startEditing() {
    if (!info) return
    setEditTitle(info.title)
    setEditDescription(info.description ?? '')
    setEditPublic(info.isPublic)
    setEditing(true)
  }

  async function addBook(bookId: string) {
    if (!info) return
    if (!(await addBookTo.run({ listId: info.id, bookId }))) {
      Alert.alert('Could not add the book', 'Check your connection and try again.')
      return
    }
    setBookQuery('')
    setAdding(false)
  }

  function removeBook(bookId: string) {
    if (!info) return
    Alert.alert('Remove book?', 'It stays in your library.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeBookFrom.fire({ listId: info.id, bookId }) },
    ])
  }

  async function saveEdit() {
    if (!info) return
    const saved = await update.run({
      id: info.id,
      title: editTitle.trim().slice(0, 80) || info.title,
      description: editDescription.trim() || null,
      isPublic: editPublic,
    })
    if (!saved) {
      Alert.alert('Could not save', 'Check your connection and try again.')
      return
    }
    setEditing(false)
  }

  function deleteList() {
    if (!info) return
    Alert.alert('Delete list?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await del.run({ id: info.id })) router.back()
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

  const isOwn = page?.isOwner ?? false

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
            onPress={startEditing}
            accessibilityRole="button"
            accessibilityLabel="Edit list"
            hitSlop={10}
            className="p-2"
          >
            <PencilSimple color={colors.textSecondary} size={20} />
          </Pressable>
        ) : (
          <ListLikeButton listId={info.id} liked={page?.liked ?? false} count={page?.likeCount ?? 0} canLike={signedIn} />
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
            {info.isPublic && (page?.likeCount ?? 0) > 0
              ? ` · ${page?.likeCount} like${page?.likeCount === 1 ? '' : 's'}`
              : ''}
          </Text>
          {info.isPublic ? (
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
            key={b.bookId}
            className="flex-row p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <Pressable
              onPress={() => {
                if (b.book) router.push(`/book/${b.book.slug}` as never)
              }}
              style={{
                width: 48,
                height: 72,
                borderRadius: 4,
                overflow: 'hidden',
                backgroundColor: colors.bgSunken,
              }}
            >
              {b.book?.coverUrl ? (
                <Image
                  source={{ uri: b.book.coverUrl }}
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
                onPress={() => removeBook(b.bookId)}
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
                  {b.coverUrl ? (
                    <Image
                      source={{ uri: b.coverUrl }}
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
