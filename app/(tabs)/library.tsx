import { useEffect, useState, useCallback } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'

type Status = 'reading' | 'want_to_read' | 'finished'

interface UserBookRow {
  id: string
  status: Status
  progress_percentage: number
  book: {
    id: string
    title: string
    author: string
    cover_url: string | null
  }
}

const TABS: Array<{ key: Status; label: string }> = [
  { key: 'reading', label: 'Currently Reading' },
  { key: 'want_to_read', label: 'Want to Read' },
  { key: 'finished', label: 'Finished' },
]

export default function Library() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Status>('reading')
  const [books, setBooks] = useState<UserBookRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBooks = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setBooks([])
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('user_books')
      .select('id, status, progress_percentage, book:books(id, title, author, cover_url)')
      .eq('user_id', user.id)
      .eq('status', activeTab)
    setBooks((data as unknown as UserBookRow[]) ?? [])
    setLoading(false)
  }, [activeTab])

  useFocusEffect(
    useCallback(() => {
      fetchBooks()
    }, [fetchBooks])
  )

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#1A1208' }}>
      <View className="px-4 pt-2 pb-4">
        <Text className="text-3xl font-serif" style={{ color: '#8B6914' }}>
          Library
        </Text>
      </View>

      <View className="flex-row px-4 mb-4">
        {TABS.map((t) => {
          const active = activeTab === t.key
          return (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              className="flex-1 py-2 items-center"
              style={{ borderBottomWidth: 2, borderBottomColor: active ? '#8B6914' : '#3D2B1F' }}
            >
              <Text style={{ color: active ? '#C4973A' : '#8B6914', fontSize: 13 }} numberOfLines={1}>
                {t.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator color="#8B6914" />
        ) : books.length === 0 ? (
          <View className="items-center mt-12 px-8">
            <Text className="text-center mb-4" style={{ color: '#E8D5B0' }}>
              {activeTab === 'reading' && "You're not reading anything yet."}
              {activeTab === 'want_to_read' && 'Your reading list is empty.'}
              {activeTab === 'finished' && "You haven't finished a book yet."}
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)')}
              className="rounded-xl px-6 py-3"
              style={{ backgroundColor: '#8B6914' }}
            >
              <Text style={{ color: '#FDF8F0' }}>Discover books</Text>
            </Pressable>
          </View>
        ) : (
          books.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => router.push(`/book/${entry.book.id}`)}
              className="flex-row mb-4 rounded-xl p-3"
              style={{ backgroundColor: '#2A1F0F' }}
            >
              <View
                className="w-16 h-24 rounded mr-3 overflow-hidden"
                style={{ backgroundColor: '#3D2B1F' }}
              >
                {entry.book.cover_url ? (
                  <Image source={{ uri: entry.book.cover_url }} className="w-full h-full" />
                ) : null}
              </View>
              <View className="flex-1 justify-center">
                <Text className="font-semibold" style={{ color: '#E8D5B0' }} numberOfLines={2}>
                  {entry.book.title}
                </Text>
                <Text style={{ color: '#8B6914' }} numberOfLines={1}>
                  {entry.book.author}
                </Text>
                {activeTab === 'reading' ? (
                  <View className="mt-2">
                    <View className="h-1 rounded-full" style={{ backgroundColor: '#3D2B1F' }}>
                      <View
                        className="h-1 rounded-full"
                        style={{
                          backgroundColor: '#8B6914',
                          width: `${Math.max(0, Math.min(100, entry.progress_percentage * 100))}%`,
                        }}
                      />
                    </View>
                    <Text className="text-xs mt-1" style={{ color: '#8B6914' }}>
                      {Math.round(entry.progress_percentage * 100)}%
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
