import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  getBook,
  getCoverUrl,
  getAuthorName,
  getAuthorEra,
  type GutenbergBook,
} from '@/lib/gutenberg'
import { ensureEpubInStorage } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'

export default function BookDetail() {
  const colors = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [book, setBook] = useState<GutenbergBook | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [prepareError, setPrepareError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let mounted = true
    ;(async () => {
      try {
        const data = await getBook(Number(id))
        if (mounted) setBook(data)
      } catch {
        if (mounted) setBook(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id])

  async function upsertBookRecord(b: GutenbergBook): Promise<string | null> {
    setPrepareError(null)
    setPreparing(true)
    const epubUrl = await ensureEpubInStorage(b.id)
    setPreparing(false)
    if (!epubUrl) {
      setPrepareError("We couldn't prepare this book for reading. Please try again.")
      return null
    }
    const cover = getCoverUrl(b)
    const author = getAuthorName(b)
    const { data, error } = await supabase
      .from('books')
      .upsert(
        {
          gutenberg_id: b.id,
          title: b.title,
          author,
          cover_url: cover,
          source: 'gutenberg',
          epub_url: epubUrl,
          language: b.languages[0] ?? 'en',
          subjects: b.subjects,
        },
        { onConflict: 'gutenberg_id' }
      )
      .select('id')
      .single()
    if (error) return null
    return data?.id ?? null
  }

  async function addToLibrary(status: 'reading' | 'want_to_read') {
    if (!book) return
    setSavingStatus(status)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSavingStatus(null)
      return
    }
    const bookId = await upsertBookRecord(book)
    if (!bookId) {
      setSavingStatus(null)
      return
    }
    await supabase
      .from('user_books')
      .upsert(
        {
          user_id: user.id,
          book_id: bookId,
          status,
          started_at: status === 'reading' ? new Date().toISOString() : null,
        },
        { onConflict: 'user_id,book_id' }
      )
    setSavingStatus(null)
  }

  async function startReading() {
    if (!book) return
    setSavingStatus('reading')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSavingStatus(null)
      return
    }
    const bookId = await upsertBookRecord(book)
    if (!bookId) {
      setSavingStatus(null)
      return
    }
    await supabase
      .from('user_books')
      .upsert(
        {
          user_id: user.id,
          book_id: bookId,
          status: 'reading',
          started_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,book_id' }
      )
    setSavingStatus(null)
    router.push(`/reader/${bookId}`)
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }

  if (!book) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8 bg-bg-base-light dark:bg-bg-base-dark">
        <Text className="font-ui text-center text-text-primary-light dark:text-text-primary-dark">
          Book not found.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-6">
          <Text className="font-ui text-brand-text-light dark:text-brand-text-dark">← Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const cover = getCoverUrl(book)
  const era = getAuthorEra(book)
  const description = book.subjects[0] ?? 'A classic work from the public domain.'

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row items-center px-4 py-2">
          <Pressable onPress={() => router.back()}>
            <Text className="font-ui text-base text-brand-text-light dark:text-brand-text-dark">
              ← Back
            </Text>
          </Pressable>
        </View>

        <View className="items-center px-4 mt-2">
          <View
            className="rounded-lg overflow-hidden mb-4 bg-bg-sunken-light dark:bg-bg-sunken-dark"
            style={{ width: '60%', aspectRatio: 2 / 3 }}
          >
            {cover ? (
              <Image source={{ uri: cover }} className="w-full h-full" resizeMode="cover" />
            ) : null}
          </View>
          <Text className="font-display text-2xl text-center mb-1 text-text-primary-light dark:text-text-primary-dark">
            {book.title}
          </Text>
          <Text className="font-ui text-text-secondary-light dark:text-text-secondary-dark">
            {getAuthorName(book)}
          </Text>
          <Text className="font-ui text-xs mt-1 text-text-tertiary-light dark:text-text-tertiary-dark">
            {era}
          </Text>
        </View>

        <View className="px-4 mt-6">
          <View className="flex-row flex-wrap gap-2 mb-4">
            {book.subjects.slice(0, 6).map((s) => (
              <View
                key={s}
                className="rounded-full px-3 py-1 bg-brand-subtle-light dark:bg-brand-subtle-dark"
              >
                <Text
                  className="font-ui text-xs text-brand-subtle-text-light dark:text-brand-subtle-text-dark"
                  numberOfLines={1}
                >
                  {s}
                </Text>
              </View>
            ))}
          </View>

          <Text className="font-body text-base leading-7 text-text-primary-light dark:text-text-primary-dark">
            {description}
          </Text>
        </View>

        <View className="px-4 mt-8 gap-3">
          {preparing ? (
            <View className="flex-row items-center justify-center gap-2 rounded-lg px-3 py-2 bg-info-bg-light dark:bg-info-bg-dark">
              <Text className="font-ui text-info-light dark:text-info-dark">ℹ</Text>
              <Text className="font-ui text-center text-xs text-info-light dark:text-info-dark">
                Preparing book…
              </Text>
            </View>
          ) : null}
          {prepareError ? (
            <View className="flex-row items-center justify-center gap-2 rounded-lg px-3 py-2 bg-error-bg-light dark:bg-error-bg-dark">
              <Text className="font-ui text-error-light dark:text-error-dark">✕</Text>
              <Text className="font-ui text-center text-sm text-error-light dark:text-error-dark flex-1">
                {prepareError}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={startReading}
            disabled={!!savingStatus}
            className="rounded-xl py-4 items-center bg-brand-ui-light dark:bg-brand-ui-dark"
            style={{ opacity: savingStatus ? 0.6 : 1 }}
          >
            {savingStatus === 'reading' ? (
              <ActivityIndicator color={colors.textOnBrand} />
            ) : (
              <Text className="font-ui-medium text-text-on-brand">
                Start reading
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => addToLibrary('want_to_read')}
            disabled={!!savingStatus}
            className="rounded-xl py-4 items-center border border-border-interactive-light dark:border-border-interactive-dark"
            style={{ opacity: savingStatus ? 0.6 : 1 }}
          >
            {savingStatus === 'want_to_read' ? (
              <ActivityIndicator color={colors.brandUi} />
            ) : (
              <Text className="font-ui text-text-primary-light dark:text-text-primary-dark">
                Add to Want to Read
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => addToLibrary('reading')}
            disabled={!!savingStatus}
            className="rounded-xl py-4 items-center border border-border-interactive-light dark:border-border-interactive-dark"
            style={{ opacity: savingStatus ? 0.6 : 1 }}
          >
            <Text className="font-ui text-text-primary-light dark:text-text-primary-dark">
              Mark as Currently Reading
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
