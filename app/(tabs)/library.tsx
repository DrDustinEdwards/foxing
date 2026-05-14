import { useEffect, useState, useCallback } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'

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
  const colors = useColors()
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
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="px-4 pt-2 pb-4">
        <Text className="font-display text-3xl text-text-primary-light dark:text-text-primary-dark">
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
              className={
                active
                  ? 'flex-1 py-2 items-center border-b-2 border-border-interactive-light dark:border-border-interactive-dark'
                  : 'flex-1 py-2 items-center border-b-2 border-border-subtle-light dark:border-border-subtle-dark'
              }
            >
              <Text
                className={
                  active
                    ? 'font-ui text-brand-text-light dark:text-brand-text-dark text-[13px]'
                    : 'font-ui text-text-tertiary-light dark:text-text-tertiary-dark text-[13px]'
                }
                numberOfLines={1}
              >
                {t.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator color={colors.brandUi} />
        ) : books.length === 0 ? (
          <View className="items-center mt-12 px-8">
            <Text className="font-ui text-center mb-4 text-text-secondary-light dark:text-text-secondary-dark">
              {activeTab === 'reading' && "You're not reading anything yet."}
              {activeTab === 'want_to_read' && 'Your reading list is empty.'}
              {activeTab === 'finished' && "You haven't finished a book yet."}
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)')}
              className="rounded-xl px-6 py-3 bg-brand-ui-light dark:bg-brand-ui-dark"
            >
              <Text className="font-ui text-text-on-brand">Discover books</Text>
            </Pressable>
          </View>
        ) : (
          books.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => router.push(`/book/${entry.book.id}`)}
              className="flex-row mb-4 rounded-xl p-3 bg-bg-surface-light dark:bg-bg-surface-dark border border-border-subtle-light dark:border-border-subtle-dark"
            >
              <View className="w-16 h-24 rounded mr-3 overflow-hidden bg-bg-sunken-light dark:bg-bg-sunken-dark">
                {entry.book.cover_url ? (
                  <Image source={{ uri: entry.book.cover_url }} className="w-full h-full" />
                ) : null}
              </View>
              <View className="flex-1 justify-center">
                <Text
                  className="font-ui-medium text-text-primary-light dark:text-text-primary-dark"
                  numberOfLines={2}
                >
                  {entry.book.title}
                </Text>
                <Text
                  className="font-ui text-text-tertiary-light dark:text-text-tertiary-dark"
                  numberOfLines={1}
                >
                  {entry.book.author}
                </Text>
                {activeTab === 'reading' ? (
                  <View className="mt-2">
                    <View className="h-1 rounded-full bg-bg-sunken-light dark:bg-bg-sunken-dark">
                      <View
                        className="h-1 rounded-full bg-brand-ui-light dark:bg-brand-ui-dark"
                        style={{
                          width: `${Math.max(0, Math.min(100, entry.progress_percentage * 100))}%`,
                        }}
                      />
                    </View>
                    <Text className="font-mono text-xs mt-1 text-text-tertiary-light dark:text-text-tertiary-dark">
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
