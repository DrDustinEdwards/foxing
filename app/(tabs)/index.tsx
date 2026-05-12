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
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#1A1208' }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B6914" />
        }
      >
        <View className="px-4 pt-2 pb-4">
          <Text className="text-3xl font-serif mb-4" style={{ color: '#8B6914' }}>
            Discover
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder="Search for books or authors"
            placeholderTextColor="#8B6914"
            returnKeyType="search"
            className="rounded-xl px-4 py-3 text-base"
            style={{ backgroundColor: '#2A1F0F', color: '#E8D5B0' }}
          />
        </View>

        <View className="px-4 mb-6">
          <Text className="text-base font-semibold mb-3" style={{ color: '#E8D5B0' }}>
            Browse by genre
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {GENRES.map((g) => {
              const active = selectedGenre === g
              return (
                <Pressable
                  key={g}
                  onPress={() => selectGenre(g)}
                  className="rounded-full px-4 py-2"
                  style={{
                    backgroundColor: active ? '#8B6914' : '#2A1F0F',
                    borderWidth: 1,
                    borderColor: active ? '#C4973A' : '#3D2B1F',
                  }}
                >
                  <Text style={{ color: active ? '#FDF8F0' : '#E8D5B0' }}>{g}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {showingResults ? (
          <View className="px-4">
            <Text className="text-base font-semibold mb-3" style={{ color: '#E8D5B0' }}>
              {query ? `Results for "${query}"` : selectedGenre}
            </Text>
            {searching ? (
              <ActivityIndicator color="#8B6914" />
            ) : activeResults.length === 0 ? (
              <Text style={{ color: '#8B6914' }}>No books found.</Text>
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
            <Text className="text-base font-semibold mb-3 px-4" style={{ color: '#E8D5B0' }}>
              Popular classics
            </Text>
            {loading ? (
              <View className="flex-row px-4">
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    className="w-32 h-48 rounded-lg mr-4"
                    style={{ backgroundColor: '#2A1F0F', opacity: 0.5 }}
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
