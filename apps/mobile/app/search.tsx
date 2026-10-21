import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  CaretLeft,
  MagnifyingGlass,
  X as XIcon,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { joinClub } from '@/lib/clubs'
import { BookResult, ClubResult, PersonResult, ResultsSection, ThreadResult } from '@/components/search/search-results'
import type { BookHit, ClubHit, ProfileHit, ThreadHit } from '@/components/search/search-types'

type FilterKey = 'all' | 'books' | 'people' | 'clubs' | 'discussions'

const FILTERS: Array<{ id: FilterKey; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'books', label: 'Books' },
  { id: 'people', label: 'People' },
  { id: 'clubs', label: 'Clubs' },
  { id: 'discussions', label: 'Discussions' },
]

const RECENT_KEY = 'recent_searches'
const MAX_RECENT = 10
const DEBOUNCE_MS = 250

export default function SearchScreen() {
  const colors = useColors()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [books, setBooks] = useState<BookHit[]>([])
  const [people, setPeople] = useState<ProfileHit[]>([])
  const [clubs, setClubs] = useState<ClubHit[]>([])
  const [threads, setThreads] = useState<ThreadHit[]>([])
  const [autocomplete, setAutocomplete] = useState<BookHit[]>([])
  const [searching, setSearching] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<TextInput>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Debounced search across the selected tabs. Tabs that aren't visible
  // still get queried in 'all' mode so the grouped view stays accurate.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setBooks([])
      setPeople([])
      setClubs([])
      setThreads([])
      setAutocomplete([])
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      await Promise.all([
        runBooks(q).then(setBooks),
        filter === 'books' ? Promise.resolve() : runPeople(q).then(setPeople),
        filter === 'books' || filter === 'people'
          ? Promise.resolve()
          : runClubs(q).then(setClubs),
        filter === 'all' || filter === 'discussions'
          ? runThreads(q).then(setThreads)
          : Promise.resolve(),
        runAutocomplete(q).then(setAutocomplete),
      ])
      setSearching(false)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [filter, query])

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
  const showAutocomplete =
    query.trim().length >= 2 && autocomplete.length > 0 && filter !== 'people' && filter !== 'discussions'

  const visibleBooks = filter === 'all' || filter === 'books' ? books : []
  const visiblePeople = filter === 'all' || filter === 'people' ? people : []
  const visibleClubs = filter === 'all' || filter === 'clubs' ? clubs : []
  const visibleThreads = filter === 'all' || filter === 'discussions' ? threads : []
  const totalResults =
    visibleBooks.length + visiblePeople.length + visibleClubs.length + visibleThreads.length

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
        {/* Autocomplete dropdown */}
        {showAutocomplete ? (
          <View
            className="rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            style={{ marginBottom: 12 }}
          >
            {autocomplete.map((b, i) => (
              <Pressable
                key={b.id}
                onPress={() => {
                  commitRecent(b.title)
                  router.push(`/book/${b.id}` as never)
                }}
                className="flex-row items-center px-3 py-2"
                style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.borderSubtle }}
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
                  {b.title}
                </Text>
                <Text
                  style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}
                  numberOfLines={1}
                >
                  {b.author}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

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
        {visibleBooks.length > 0 ? (
          <ResultsSection title="Books">
            {visibleBooks.map((b) => (
              <BookResult
                key={b.id}
                hit={b}
                onPress={() => {
                  commitRecent(b.title)
                  router.push(`/book/${b.id}` as never)
                }}
                onAdd={async () => {
                  const { data: { user } } = await supabase.auth.getUser()
                  if (!user) return
                  await supabase
                    .from('user_books')
                    .upsert(
                      { user_id: user.id, book_id: b.id, status: 'want_to_read' },
                      { onConflict: 'user_id,book_id' },
                    )
                }}
              />
            ))}
          </ResultsSection>
        ) : null}

        {visiblePeople.length > 0 ? (
          <ResultsSection title="People">
            {visiblePeople.map((p) => (
              <PersonResult
                key={p.id}
                hit={p}
                onPress={() => router.push(`/user/${p.id}` as never)}
              />
            ))}
          </ResultsSection>
        ) : null}

        {visibleClubs.length > 0 ? (
          <ResultsSection title="Clubs">
            {visibleClubs.map((c) => (
              <ClubResult
                key={c.id}
                hit={c}
                onPress={() => router.push(`/clubs/${c.id}` as never)}
                onJoin={async () => {
                  await joinClub(c.id)
                }}
              />
            ))}
          </ResultsSection>
        ) : null}

        {visibleThreads.length > 0 ? (
          <ResultsSection title="Discussions">
            {visibleThreads.map((t) => (
              <ThreadResult
                key={t.id}
                hit={t}
                onPress={() =>
                  router.push(`/clubs/${t.club_id}/thread/${t.id}` as never)
                }
              />
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

// ── Queries ──────────────────────────────────────────────────────────────

async function runBooks(q: string): Promise<BookHit[]> {
  const ilike = `%${q}%`
  const { data } = await supabase
    .from('books')
    .select('id, title, author, cover_url, subjects')
    .or(`title.ilike.${ilike},author.ilike.${ilike}`)
    .limit(10)
  return ((data ?? []) as BookHit[])
}

async function runPeople(q: string): Promise<ProfileHit[]> {
  const ilike = `%${q}%`
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .or(`display_name.ilike.${ilike},username.ilike.${ilike}`)
    .limit(10)
  return ((data ?? []) as ProfileHit[])
}

async function runClubs(q: string): Promise<ClubHit[]> {
  const ilike = `%${q}%`
  const { data } = await supabase
    .from('clubs')
    .select('id, name, member_count, current_book:books!current_book_id(title)')
    .ilike('name', ilike)
    .eq('is_public', true)
    .limit(10)
  type R = {
    id: string; name: string; member_count: number;
    current_book: { title: string } | Array<{ title: string }> | null
  }
  return (((data ?? []) as unknown) as R[]).map((c) => ({
    id: c.id,
    name: c.name,
    member_count: c.member_count,
    current_book: Array.isArray(c.current_book) ? c.current_book[0] ?? null : c.current_book,
  }))
}

async function runThreads(q: string): Promise<ThreadHit[]> {
  const ilike = `%${q}%`
  const { data } = await supabase
    .from('club_threads')
    .select('id, title, club_id, post_count, club:clubs!club_id(name)')
    .ilike('title', ilike)
    .limit(10)
  type R = {
    id: string; title: string; club_id: string; post_count: number;
    club: { name: string } | Array<{ name: string }> | null
  }
  return (((data ?? []) as unknown) as R[]).map((t) => ({
    id: t.id,
    title: t.title,
    club_id: t.club_id,
    post_count: t.post_count,
    club: Array.isArray(t.club) ? t.club[0] ?? null : t.club,
  }))
}

async function runAutocomplete(q: string): Promise<BookHit[]> {
  const ilike = `${q}%` // prefix match for typeahead
  const { data } = await supabase
    .from('books')
    .select('id, title, author, cover_url, subjects')
    .ilike('title', ilike)
    .limit(5)
  return ((data ?? []) as BookHit[])
}

// ── Components ───────────────────────────────────────────────────────────

