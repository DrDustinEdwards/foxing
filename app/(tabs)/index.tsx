import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  searchBooks,
  getPopularBooks,
  getBooksBySubject,
  type GutenbergBook,
} from '@/lib/gutenberg'
import { BookCard } from '@/components/ui/book-card'
import { useColors } from '@/constants/colors'

const GENRES = [
  'Fiction',
  'Mystery',
  'Romance',
  'Adventure',
  'Horror',
  'Poetry',
  'Philosophy',
  'History',
]

export default function Discover() {
  const colors = useColors()
  const [query, setQuery] = useState('')
  const [popular, setPopular] = useState<GutenbergBook[]>([])
  const [searchResults, setSearchResults] = useState<GutenbergBook[]>([])
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [genreResults, setGenreResults] = useState<GutenbergBook[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadPopular = useCallback(async () => {
    try {
      const response = await getPopularBooks()
      setPopular(response.results.slice(0, 20))
    } catch {
      setPopular([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPopular()
  }, [loadPopular])

  async function handleSearch() {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const response = await searchBooks(query)
      setSearchResults(response.results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  async function selectGenre(genre: string) {
    if (selectedGenre === genre) {
      setSelectedGenre(null)
      setGenreResults([])
      return
    }
    setSelectedGenre(genre)
    setSearching(true)
    try {
      const response = await getBooksBySubject(genre.toLowerCase())
      setGenreResults(response.results)
    } catch {
      setGenreResults([])
    } finally {
      setSearching(false)
    }
  }

  async function onRefresh() {
    setRefreshing(true)
    await loadPopular()
    setRefreshing(false)
  }

  const showingResults = query.trim().length > 0 || selectedGenre !== null
  const activeResults = query.trim().length > 0 ? searchResults : genreResults

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandUi} />
        }
      >
        <View className="px-4 pt-2 pb-4">
          <Text className="font-display text-3xl mb-4 text-text-primary-light dark:text-text-primary-dark">
            Discover
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder="Search for books or authors"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
            className="font-ui rounded-xl px-4 py-3 text-base bg-bg-surface-light dark:bg-bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-interactive-light dark:border-border-interactive-dark"
          />
        </View>

        <View className="px-4 mb-6">
          <Text className="font-ui-medium text-base mb-3 text-text-secondary-light dark:text-text-secondary-dark">
            Browse by genre
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {GENRES.map((g) => {
              const active = selectedGenre === g
              return (
                <Pressable
                  key={g}
                  onPress={() => selectGenre(g)}
                  className={
                    active
                      ? 'rounded-full px-4 py-2 border bg-brand-ui-light dark:bg-brand-ui-dark border-border-interactive-light dark:border-border-interactive-dark'
                      : 'rounded-full px-4 py-2 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark'
                  }
                >
                  <Text
                    className={
                      active
                        ? 'font-ui text-text-on-brand'
                        : 'font-ui text-text-primary-light dark:text-text-primary-dark'
                    }
                  >
                    {g}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {showingResults ? (
          <View className="px-4">
            <Text className="font-ui-medium text-base mb-3 text-text-secondary-light dark:text-text-secondary-dark">
              {query ? `Results for "${query}"` : selectedGenre}
            </Text>
            {searching ? (
              <ActivityIndicator color={colors.brandUi} />
            ) : activeResults.length === 0 ? (
              <Text className="font-ui text-text-tertiary-light dark:text-text-tertiary-dark">
                No books found.
              </Text>
            ) : (
              <View className="flex-row flex-wrap justify-between">
                {activeResults.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View>
            <Text className="font-ui-medium text-base mb-3 px-4 text-text-secondary-light dark:text-text-secondary-dark">
              Popular classics
            </Text>
            {loading ? (
              <View className="flex-row px-4">
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    className="w-32 h-48 rounded-lg mr-4 bg-skeleton-base-light dark:bg-skeleton-base-dark"
                  />
                ))}
              </View>
            ) : (
              <FlatList
                horizontal
                data={popular}
                keyExtractor={(b) => String(b.id)}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => <BookCard book={item} variant="horizontal" />}
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
