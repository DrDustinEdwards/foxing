import { useSearch, useSetBookStatus, useSuggest } from '@foxing/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { CaretLeft, MagnifyingGlass, X as XIcon } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { authClient } from '@/lib/api'
import { AuthorResult, BookResult, ClubResult, PersonResult, ResultsSection } from '@/components/search/search-results'

type FilterKey = 'all' | 'books' | 'authors' | 'people' | 'clubs'

const FILTERS: Array<{ id: FilterKey; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'books', label: 'Books' },
  { id: 'authors', label: 'Authors' },
  { id: 'people', label: 'People' },
  { id: 'clubs', label: 'Clubs' },
]

const RECENT_KEY = 'recent_searches'
const MAX_RECENT = 10
const DEBOUNCE_MS = 250

// Search: books and authors from GET /search, people and clubs from the same
// typeahead the web header uses.
export default function SearchScreen() {
  const colors = useColors()
  const router = useRouter()
  const session = authClient.useSession()
  const setBookStatus = useSetBookStatus()
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    // Autofocus on open.
    setTimeout(() => inputRef.current?.focus(), 50)
    AsyncStorage.getItem(RECENT_KEY).then((raw) => {
      if (!raw) return
      try {
        const parsed = JSON.parse(raw) as string[]
        if (Array.isArray(parsed)) setRecent(parsed.slice(0, MAX_RECENT))
      } catch { /* ignore */ }
    })
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim().length >= 2 ? query.trim() : ''), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])
  const search = useSearch(term)
  const suggest = useSuggest(query)
  const searching = term.length > 0 && search.isFetching

  const commitRecent = useCallback(async (term: string) => {
    const t = term.trim()
    if (t.length < 2) return
    const next = [t, ...recent.filter((r) => r !== t)].slice(0, MAX_RECENT)
    setRecent(next)
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next))
  }, [recent])

  const removeRecent = useCallback(
    async (term: string) => {
      const next = recent.filter((r) => r !== term)
      setRecent(next)
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next))
    },
    [recent],
  )

  const showRecent = query.trim().length < 2 && recent.length > 0
  const show = (f: FilterKey) => filter === 'all' || filter === f
  const results = term ? search.data : undefined
  const visibleBooks = show('books') ? (results?.books ?? []) : []
  const visibleAuthors = show('authors') ? (results?.authors ?? []) : []
  const visiblePeople = show('people') ? suggest.people : []
  const visibleClubs = show('clubs') ? suggest.clubs : []
  const totalResults = visibleBooks.length + visibleAuthors.length + visiblePeople.length + visibleClubs.length

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <View
          className="flex-row items-center flex-1 px-3 py-2 rounded-full border"
          style={{ borderColor: colors.borderSubtle, backgroundColor: colors.bgSurface, marginLeft: 4 }}
        >
          <MagnifyingGlass color={colors.textTertiary} size={16} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => commitRecent(query)}
            placeholder="Search Foxing"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textPrimary,
              marginLeft: 8,
            }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <XIcon color={colors.textTertiary} size={14} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingBottom: 4 }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.id
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              className="px-3 py-1 rounded-full border"
              style={{
                backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                borderColor: active ? colors.borderBrand : colors.borderSubtle,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 12,
                  color: active ? colors.brandText : colors.textSecondary,
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        {/* Recent searches */}
        {showRecent ? (
          <View>
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 11,
                color: colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 8,
              }}
            >
              Recent searches
            </Text>
            {recent.map((r) => (
              <View key={r} className="flex-row items-center mb-1">
                <Pressable
                  onPress={() => setQuery(r)}
                  className="flex-row items-center flex-1 px-3 py-2 rounded-xl"
                  style={{ backgroundColor: colors.bgSurface }}
                >
                  <MagnifyingGlass color={colors.textTertiary} size={12} />
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: Fonts.body,
                      fontSize: 13,
                      color: colors.textPrimary,
                      marginLeft: 8,
                    }}
                    numberOfLines={1}
                  >
                    {r}
                  </Text>
                </Pressable>
                <Pressable onPress={() => removeRecent(r)} hitSlop={6} style={{ padding: 6 }}>
                  <XIcon color={colors.textTertiary} size={14} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {/* Empty state */}
        {query.trim().length >= 2 && !searching && totalResults === 0 ? (
          <View style={{ paddingVertical: 32, alignItems: 'center', paddingHorizontal: 24 }}>
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 14,
                color: colors.textTertiary,
                textAlign: 'center',
              }}
            >
              No results for "{query.trim()}"
            </Text>
          </View>
        ) : null}

        {/* Results */}
        {results?.fuzzy && visibleBooks.length > 0 ? (
          <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary }}>
            No exact matches, so these are the closest.
          </Text>
        ) : null}
        {visibleBooks.length > 0 ? (
          <ResultsSection title="Books">
            {visibleBooks.map((b) => (
              <BookResult
                key={b.id}
                hit={b}
                onPress={() => {
                  commitRecent(b.title)
                  router.push(`/book/${b.slug}` as never)
                }}
                onAdd={() =>
                  session.data
                    ? setBookStatus.fire({ bookId: b.id, status: 'want', book: b })
                    : router.push('/(auth)/login' as never)
                }
              />
            ))}
          </ResultsSection>
        ) : null}

        {visibleAuthors.length > 0 ? (
          <ResultsSection title="Authors">
            {visibleAuthors.map((a) => (
              <AuthorResult key={a.slug} hit={a} onPress={() => router.push(`/author/${a.slug}` as never)} />
            ))}
          </ResultsSection>
        ) : null}

        {visiblePeople.length > 0 ? (
          <ResultsSection title="People">
            {visiblePeople.map((p) => (
              <PersonResult key={p.username} hit={p} onPress={() => router.push(`/u/${p.username}` as never)} />
            ))}
          </ResultsSection>
        ) : null}

        {visibleClubs.length > 0 ? (
          <ResultsSection title="Clubs">
            {visibleClubs.map((c) => (
              <ClubResult key={c.id} hit={c} onPress={() => router.push(`/clubs/${c.id}` as never)} />
            ))}
          </ResultsSection>
        ) : null}

        {searching && totalResults === 0 ? (
          <View style={{ paddingVertical: 32, alignItems: 'center' }}>
            <ActivityIndicator color={colors.brandUi} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}
