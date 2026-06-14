import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Share,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, Plus, ShareNetwork, Trash, Eye, EyeSlash } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/feed'

interface Entry {
  id: string
  passage_text: string
  book_title: string | null
  note: string | null
  is_public: boolean
  created_at: string
  book: { title: string | null; author: string | null } | null
}

type Filter = 'all' | 'public' | 'private'

export default function CommonplaceScreen() {
  const colors = useColors()
  const router = useRouter()
  const [entries, setEntries] = useState<Entry[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [passage, setPassage] = useState('')
  const [bookTitle, setBookTitle] = useState('')
  const [note, setNote] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setEntries([])
      setLoading(false)
      return
    }
    setUserId(user.id)
    const { data } = await supabase
      .from('commonplace_book')
      .select(
        'id, passage_text, book_title, note, is_public, created_at, book:book_id(title, author)',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    const rows = ((data ?? []) as unknown) as Array<Record<string, unknown>>
    const normalized: Entry[] = rows.map((r) => {
      const book = r.book as unknown
      const bookObj = Array.isArray(book)
        ? (book[0] as { title?: string | null; author?: string | null } | undefined)
        : (book as { title?: string | null; author?: string | null } | null)
      return {
        id: String(r.id),
        passage_text: String(r.passage_text ?? ''),
        book_title: (r.book_title as string | null) ?? null,
        note: (r.note as string | null) ?? null,
        is_public: Boolean(r.is_public),
        created_at: String(r.created_at),
        book: bookObj
          ? { title: bookObj.title ?? null, author: bookObj.author ?? null }
          : null,
      }
    })
    setEntries(normalized)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    if (filter === 'all') return entries
    if (filter === 'public') return entries.filter((e) => e.is_public)
    return entries.filter((e) => !e.is_public)
  }, [entries, filter])

  async function saveEntry() {
    if (!userId) return
    if (!passage.trim()) return
    setSaving(true)
    const { error } = await supabase.from('commonplace_book').insert({
      user_id: userId,
      passage_text: passage.trim().slice(0, 5000),
      book_title: bookTitle.trim() || null,
      note: note.trim() || null,
      is_public: isPublic,
    })
    setSaving(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    setPassage('')
    setBookTitle('')
    setNote('')
    setIsPublic(false)
    setAddOpen(false)
    void load()
  }

  async function removeEntry(id: string) {
    if (!userId) return
    Alert.alert('Delete entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('commonplace_book')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)
          if (error) {
            Alert.alert('Could not delete', error.message)
            return
          }
          setEntries((prev) => prev.filter((e) => e.id !== id))
        },
      },
    ])
  }

  async function exportAll() {
    if (entries.length === 0) return
    const text = entries
      .map((e) => {
        const book = e.book?.title
          ? `${e.book.title}${e.book.author ? ` by ${e.book.author}` : ''}`
          : e.book_title ?? 'Unknown book'
        const noteLine = e.note ? `\nNote: ${e.note}` : ''
        return `${e.passage_text}\n— ${book}${noteLine}`
      })
      .join('\n\n')
    try {
      await Share.share({ message: text })
    } catch (err) {
      console.warn('[commonplace] share failed', err)
    }
  }

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
          Commonplace Book
        </Text>
        <Pressable onPress={exportAll} hitSlop={10} className="p-2">
          <ShareNetwork color={colors.textSecondary} size={20} />
        </Pressable>
        <Pressable
          onPress={() => setAddOpen(true)}
          hitSlop={10}
          className="p-2"
        >
          <Plus color={colors.brandUi} size={22} weight="bold" />
        </Pressable>
      </View>

      <View className="flex-row gap-2 px-4 pb-3">
        {(['all', 'public', 'private'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor:
                filter === f ? colors.brandSubtle : colors.bgSurface,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: filter === f ? colors.textPrimary : colors.textTertiary,
                textTransform: 'capitalize',
              }}
            >
              {f}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : visible.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textTertiary,
              textAlign: 'center',
            }}
          >
            Save passages from any book to build your personal anthology.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        >
          {visible.map((e) => (
            <View
              key={e.id}
              className="p-4 mb-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text
                style={{
                  fontFamily: Fonts.bodyItalic,
                  fontSize: 16,
                  lineHeight: 24,
                  color: colors.textPrimary,
                }}
              >
                {e.passage_text}
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 12,
                  color: colors.textTertiary,
                  marginTop: 8,
                }}
              >
                {e.book?.title
                  ? `${e.book.title}${e.book.author ? ` · ${e.book.author}` : ''}`
                  : e.book_title ?? 'Unknown book'}
              </Text>
              {e.note ? (
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginTop: 6,
                  }}
                >
                  {e.note}
                </Text>
              ) : null}
              <View className="flex-row items-center justify-between mt-3">
                <View className="flex-row items-center">
                  {e.is_public ? (
                    <Eye color={colors.info} size={14} />
                  ) : (
                    <EyeSlash color={colors.textTertiary} size={14} />
                  )}
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 11,
                      color: colors.textTertiary,
                      marginLeft: 6,
                    }}
                  >
                    {e.is_public ? 'Public' : 'Private'} ·{' '}
                    {relativeTime(e.created_at)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => removeEntry(e.id)}
                  hitSlop={10}
                  className="p-1"
                >
                  <Trash color={colors.textTertiary} size={16} />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={addOpen}
        animationType="slide"
        onRequestClose={() => setAddOpen(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
          <View className="flex-row items-center px-3 py-2">
            <Pressable onPress={() => setAddOpen(false)} hitSlop={10} className="p-2">
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
              Save a passage
            </Text>
            <Pressable
              onPress={saveEntry}
              disabled={saving || !passage.trim()}
              className="px-4 py-2 rounded-full"
              style={{
                backgroundColor: passage.trim()
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
              value={passage}
              onChangeText={setPassage}
              placeholder="Paste a passage..."
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={5000}
              style={{
                fontFamily: Fonts.bodyItalic,
                fontSize: 16,
                color: colors.textPrimary,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
                minHeight: 140,
                textAlignVertical: 'top',
              }}
            />
            <TextInput
              value={bookTitle}
              onChangeText={setBookTitle}
              placeholder="Book title (optional)"
              placeholderTextColor={colors.textTertiary}
              maxLength={200}
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
              }}
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Note (optional)"
              placeholderTextColor={colors.textTertiary}
              maxLength={500}
              multiline
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
                minHeight: 60,
                textAlignVertical: 'top',
              }}
            />
            <Pressable
              onPress={() => setIsPublic((v) => !v)}
              className="flex-row items-center gap-3 p-3 rounded-xl border border-border-subtle-light dark:border-border-subtle-dark"
            >
              {isPublic ? (
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
                {isPublic ? 'Public on profile' : 'Private to you'}
              </Text>
            </Pressable>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}
