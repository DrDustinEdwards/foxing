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
  getEpubUrl,
  getAuthorName,
  getAuthorEra,
  type GutenbergBook,
} from '@/lib/gutenberg'
import { supabase } from '@/lib/supabase'

export default function BookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [book, setBook] = useState<GutenbergBook | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState<string | null>(null)

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
    const cover = getCoverUrl(b)
    const epub = getEpubUrl(b)
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
          epub_url: epub ?? '',
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
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: '#1A1208' }}>
        <ActivityIndicator color="#8B6914" />
      </SafeAreaView>
    )
  }

  if (!book) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8" style={{ backgroundColor: '#1A1208' }}>
        <Text className="text-center" style={{ color: '#E8D5B0' }}>
          Book not found.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-6">
          <Text style={{ color: '#C4973A' }}>← Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const cover = getCoverUrl(book)
  const era = getAuthorEra(book)
  const description = book.subjects[0] ?? 'A classic work from the public domain.'

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#1A1208' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row items-center px-4 py-2">
          <Pressable onPress={() => router.back()}>
            <Text className="text-base" style={{ color: '#C4973A' }}>
              ← Back
            </Text>
          </Pressable>
        </View>

        <View className="items-center px-4 mt-2">
          <View
            className="rounded-lg overflow-hidden mb-4"
            style={{
              width: '60%',
              aspectRatio: 2 / 3,
              backgroundColor: '#2A1F0F',
            }}
          >
            {cover ? (
              <Image source={{ uri: cover }} className="w-full h-full" resizeMode="cover" />
            ) : null}
          </View>
          <Text className="text-2xl font-serif text-center mb-1" style={{ color: '#E8D5B0' }}>
            {book.title}
          </Text>
          <Text style={{ color: '#C4973A' }}>{getAuthorName(book)}</Text>
          <Text className="text-xs mt-1" style={{ color: '#8B6914' }}>
            {era}
          </Text>
        </View>

        <View className="px-4 mt-6">
          <View className="flex-row flex-wrap gap-2 mb-4">
            {book.subjects.slice(0, 6).map((s) => (
              <View
                key={s}
                className="rounded-full px-3 py-1"
                style={{ backgroundColor: '#2A1F0F' }}
              >
                <Text className="text-xs" style={{ color: '#C4973A' }} numberOfLines={1}>
                  {s}
                </Text>
              </View>
            ))}
          </View>

          <Text className="text-sm leading-6" style={{ color: '#E8D5B0' }}>
            {description}
          </Text>
        </View>

        <View className="px-4 mt-8 gap-3">
          <Pressable
            onPress={startReading}
            disabled={savingStatus === 'reading'}
            className="rounded-xl py-4 items-center"
            style={{ backgroundColor: '#8B6914', opacity: savingStatus ? 0.6 : 1 }}
          >
            {savingStatus === 'reading' ? (
              <ActivityIndicator color="#FDF8F0" />
            ) : (
              <Text className="font-semibold" style={{ color: '#FDF8F0' }}>
                Start reading
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => addToLibrary('want_to_read')}
            disabled={savingStatus === 'want_to_read'}
            className="rounded-xl py-4 items-center border"
            style={{ borderColor: '#3D2B1F', opacity: savingStatus ? 0.6 : 1 }}
          >
            {savingStatus === 'want_to_read' ? (
              <ActivityIndicator color="#C4973A" />
            ) : (
              <Text style={{ color: '#E8D5B0' }}>Add to Want to Read</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => addToLibrary('reading')}
            disabled={savingStatus === 'reading'}
            className="rounded-xl py-4 items-center border"
            style={{ borderColor: '#3D2B1F', opacity: savingStatus ? 0.6 : 1 }}
          >
            <Text style={{ color: '#E8D5B0' }}>Mark as Currently Reading</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
