import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Sparkle, MagnifyingGlass } from 'phosphor-react-native'
import {
  searchBooks as searchGutenberg,
  type GutenbergBook,
} from '@/lib/gutenberg'
import { BookCard } from '@/components/ui/book-card'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { getAIRecommendations, type RecommendedBook } from '@/lib/recommendations'
import { BrowseBy, ChipRow, ClubMiniCard, SectionRow, SectionWrap, TodaysPickHero } from '@/components/discover/discover-sections'
import type { ClubLite, SupaBook } from '@/components/discover/discover-types'

// ── Static taxonomies for the chip rows ──────────────────────────────────

const MOODS = [
  'Dark', 'Uplifting', 'Adventurous', 'Romantic',
  'Mysterious', 'Philosophical', 'Funny', 'Heartbreaking',
]
const ERAS = [
  'Ancient', 'Medieval', '1700s', '1800s', 'Early 1900s', 'Mid 1900s',
]
const LENGTHS: Array<{ label: string; value: string }> = [
  { label: 'Short story (<50pp)', value: 'short' },
  { label: 'Novella (50-150)', value: 'novella' },
  { label: 'Novel (150-400)', value: 'novel' },
  { label: 'Long novel (400+)', value: 'long' },
]
const THEMES = [
  'Love', 'War', 'Family', 'Identity', 'Justice',
  'Nature', 'Power', 'Death', 'Faith', 'Class',
]
const COUNTRIES = [
  'England', 'France', 'Russia', 'United States', 'Germany',
  'Japan', 'Spain', 'Italy', 'Ireland', 'India',
]

// Hardcoded curatorial picks, title-matched against the local books table
// so they only surface for titles you've actually ingested. Easier to maintain
// than a separate `editorial` table for v1.
const STAFF_PICKS = [
  'Pride and Prejudice',
  'Frankenstein; Or, The Modern Prometheus',
  'Frankenstein',
  'Dracula',
  'The Great Gatsby',
  'Crime and Punishment',
]
const ADAPTATIONS = [
  'Pride and Prejudice', 'Frankenstein', 'Dracula', 'The Great Gatsby',
  'Little Women', 'The Picture of Dorian Gray', 'A Christmas Carol',
  'The Adventures of Sherlock Holmes', 'The Time Machine', 'War of the Worlds',
]

// Rotates daily, uses day-of-year as deterministic seed. Replace with
// a curated highlights pull when there's enough content in the highlights
// table to seed it from.
const DAILY_PASSAGES: Array<{ text: string; source: string }> = [
  { text: 'It was the best of times, it was the worst of times…', source: 'Charles Dickens, A Tale of Two Cities' },
  { text: 'All happy families are alike; each unhappy family is unhappy in its own way.', source: 'Leo Tolstoy, Anna Karenina' },
  { text: 'Call me Ishmael.', source: 'Herman Melville, Moby-Dick' },
  { text: 'I am no bird; and no net ensnares me: I am a free human being with an independent will.', source: 'Charlotte Brontë, Jane Eyre' },
  { text: 'It is a truth universally acknowledged…', source: 'Jane Austen, Pride and Prejudice' },
  { text: 'Whatever our souls are made of, his and mine are the same.', source: 'Emily Brontë, Wuthering Heights' },
  { text: 'There is no greater agony than bearing an untold story inside you.', source: 'Maya Angelou' },
  { text: 'We are all in the gutter, but some of us are looking at the stars.', source: 'Oscar Wilde, Lady Windermere\'s Fan' },
]

export default function Discover() {
  const colors = useColors()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GutenbergBook[]>([])
  const [searching, setSearching] = useState(false)

  const [viewerId, setViewerId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  // Personalized
  const [lastFinished, setLastFinished] = useState<SupaBook | null>(null)
  const [similar, setSimilar] = useState<SupaBook[]>([])
  const [friendsReading, setFriendsReading] = useState<SupaBook[]>([])
  const [popularInClubs, setPopularInClubs] = useState<SupaBook[]>([])

  // AI recs (cached per session)
  const [recs, setRecs] = useState<RecommendedBook[] | null>(null)
  const [recsBusy, setRecsBusy] = useState(false)

  // Editorial
  const [staffPicks, setStaffPicks] = useState<SupaBook[]>([])
  const [awardWinners, setAwardWinners] = useState<SupaBook[]>([])
  const [adaptations, setAdaptations] = useState<SupaBook[]>([])

  // Social
  const [activeClubs, setActiveClubs] = useState<ClubLite[]>([])
  const [trending, setTrending] = useState<SupaBook[]>([])

  // Discovery: less-read books and new arrivals
  const [hiddenGems, setHiddenGems] = useState<SupaBook[]>([])
  const [newAdditions, setNewAdditions] = useState<SupaBook[]>([])

  // Daily passage, index based on day-of-year so it's stable per day.
  const dailyPassage = useMemo(() => {
    const start = new Date(new Date().getFullYear(), 0, 0)
    const diff = Date.now() - start.getTime()
    const dayOfYear = Math.floor(diff / 86_400_000)
    return DAILY_PASSAGES[dayOfYear % DAILY_PASSAGES.length]
  }, [])
  void dailyPassage // Passage of the day removed from this screen, kept for future use.

  // Today's Pick, rotates daily from staff picks (or trending as a fallback)
  // so the discover screen has a hero from day one.
  const todaysPick = useMemo<SupaBook | null>(() => {
    const pool = staffPicks.length > 0 ? staffPicks : trending
    if (pool.length === 0) return null
    const start = new Date(new Date().getFullYear(), 0, 0)
    const diff = Date.now() - start.getTime()
    const dayOfYear = Math.floor(diff / 86_400_000)
    return pool[dayOfYear % pool.length]
  }, [staffPicks, trending])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setViewerId(user?.id ?? null)

    // ── 1. Personalized: last finished + similar books ────────────────────
    let lastFinishedBook: SupaBook | null = null
    let similarBooks: SupaBook[] = []
    let friendsRows: SupaBook[] = []
    let popularInClubsRows: SupaBook[] = []
    let trendingRows: SupaBook[] = []

    if (user) {
      const lastFinishedRes = await supabase
        .from('user_books')
        .select('book:books(id, title, author, cover_url, subjects)')
        .eq('user_id', user.id)
        .eq('status', 'finished')
        .order('finished_at', { ascending: false })
        .limit(1)
      type LF = { book: { id: string; title: string; author: string; cover_url: string | null; subjects: string[] | null } | Array<{ id: string; title: string; author: string; cover_url: string | null; subjects: string[] | null }> | null }
      const lfRow = ((lastFinishedRes.data ?? [])[0] as unknown) as LF | undefined
      const lfBook = lfRow ? (Array.isArray(lfRow.book) ? lfRow.book[0] : lfRow.book) : null
      if (lfBook) {
        lastFinishedBook = {
          id: lfBook.id,
          title: lfBook.title,
          author: lfBook.author,
          cover_url: lfBook.cover_url,
        }
        // Pull similar books by overlapping subject, picks the first
        // subject as a coarse signal. Excludes the book itself.
        const subj = (lfBook.subjects ?? []).find((s) => !!s)
        if (subj) {
          const seg = subj.split(/[\u2014\u2013\-:]/)[0].trim().slice(0, 40)
          const { data } = await supabase
            .from('books')
            .select('id, title, author, cover_url, epub_url')
            .contains('subjects', [seg])
            .neq('id', lfBook.id)
            .limit(5)
          similarBooks = (data ?? []) as SupaBook[]
        }
      }

      // Friends are reading, books with status='reading' for followed users.
      const { data: followsRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
      const followedIds = ((followsRows ?? []) as Array<{ following_id: string }>).map((r) => r.following_id)
      if (followedIds.length > 0) {
        const { data } = await supabase
          .from('user_books')
          .select('book:books(id, title, author, cover_url, epub_url)')
          .in('user_id', followedIds)
          .eq('status', 'reading')
          .limit(10)
        type R = { book: { id: string; title: string; author: string; cover_url: string | null; epub_url: string | null } | Array<{ id: string; title: string; author: string; cover_url: string | null; epub_url: string | null }> | null }
        const seen = new Set<string>()
        for (const r of ((data ?? []) as unknown) as R[]) {
          const b = Array.isArray(r.book) ? r.book[0] : r.book
          if (b && !seen.has(b.id)) {
            seen.add(b.id)
            friendsRows.push(b)
          }
        }
      }

      // Popular in your clubs, current_book_id across user's clubs.
      const { data: membershipRows } = await supabase
        .from('club_members')
        .select('clubs:club_id(current_book_id, current_book:books!current_book_id(id, title, author, cover_url, epub_url))')
        .eq('user_id', user.id)
      type MR = { clubs: { current_book_id: string | null; current_book: { id: string; title: string; author: string; cover_url: string | null; epub_url: string | null } | null } | Array<{ current_book_id: string | null; current_book: { id: string; title: string; author: string; cover_url: string | null; epub_url: string | null } | null }> | null }
      const seenClubs = new Set<string>()
      for (const r of ((membershipRows ?? []) as unknown) as MR[]) {
        const c = Array.isArray(r.clubs) ? r.clubs[0] : r.clubs
        const b = c?.current_book
        if (b && !seenClubs.has(b.id)) {
          seenClubs.add(b.id)
          popularInClubsRows.push(b)
        }
      }
    }

    // ── 2. Editorial, title-match against the catalog ────────────────────
    const [staffRes, adaptRes] = await Promise.all([
      supabase
        .from('books')
        .select('id, title, author, cover_url, epub_url')
        .in('title', STAFF_PICKS)
        .limit(6),
      supabase
        .from('books')
        .select('id, title, author, cover_url, epub_url')
        .in('title', ADAPTATIONS)
        .limit(10),
    ])
    // Award winners: rough heuristic, subjects mention any major award. The
    // public-domain catalog doesn't have many, so this often comes back empty
    // and we just skip the section.
    const { data: awardRows } = await supabase
      .from('books')
      .select('id, title, author, cover_url, subjects')
      .or(
        'subjects.cs.{Booker},subjects.cs.{Nobel},subjects.cs.{Pulitzer Prize}',
      )
      .limit(6)

    // ── 3. Active clubs needing members ───────────────────────────────────
    const { data: clubRows } = await supabase
      .from('clubs')
      .select('id, name, member_count, current_book_id, current_book:books!current_book_id(id, title, author, cover_url)')
      .eq('is_public', true)
      .lt('member_count', 10)
      .order('member_count', { ascending: false })
      .limit(6)
    type CR = {
      id: string; name: string; member_count: number; current_book_id: string | null;
      current_book: SupaBook | SupaBook[] | null
    }
    const activeClubsRows: ClubLite[] = (((clubRows ?? []) as unknown) as CR[]).map((c) => ({
      id: c.id,
      name: c.name,
      member_count: c.member_count,
      current_book_id: c.current_book_id,
      current_book: Array.isArray(c.current_book) ? c.current_book[0] ?? null : c.current_book,
    }))

    // ── 4. Trending, top books by reading_sessions count in last 7 days. ──
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const { data: sessionRows } = await supabase
      .from('reading_sessions')
      .select('book_id')
      .gte('started_at', since)
      .limit(500)
    const counts = new Map<string, number>()
    for (const r of (sessionRows ?? []) as Array<{ book_id: string }>) {
      counts.set(r.book_id, (counts.get(r.book_id) ?? 0) + 1)
    }
    const topBookIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id)
    if (topBookIds.length > 0) {
      const { data } = await supabase
        .from('books')
        .select('id, title, author, cover_url, epub_url')
        .in('id', topBookIds)
      trendingRows = (data ?? []) as SupaBook[]
    }

    // ── 5. Hidden gems, books with few readers but not zero. ─────────────
    // Strategy: pull books with a low (but >0) user_books count via RPC-style
    // count grouping. Postgrest can't group easily here, so we approximate by
    // pulling recent additions and filtering by reader count client-side.
    let hiddenGemsRows: SupaBook[] = []
    {
      const { data: gemCandidates } = await supabase
        .from('books')
        .select('id, title, author, cover_url, epub_url')
        .order('created_at', { ascending: false })
        .limit(60)
      const candidates = (gemCandidates ?? []) as SupaBook[]
      if (candidates.length > 0) {
        const ids = candidates.map((b) => b.id)
        const { data: countsRows } = await supabase
          .from('user_books')
          .select('book_id')
          .in('book_id', ids)
        const counts = new Map<string, number>()
        for (const r of (countsRows ?? []) as Array<{ book_id: string }>) {
          counts.set(r.book_id, (counts.get(r.book_id) ?? 0) + 1)
        }
        hiddenGemsRows = candidates
          .filter((b) => {
            const c = counts.get(b.id) ?? 0
            return c >= 1 && c <= 3
          })
          .slice(0, 8)
      }
    }

    // ── 6. New additions, most recently ingested. ────────────────────────
    let newAdditionsRows: SupaBook[] = []
    {
      const { data } = await supabase
        .from('books')
        .select('id, title, author, cover_url, epub_url')
        .order('created_at', { ascending: false })
        .limit(12)
      newAdditionsRows = (data ?? []) as SupaBook[]
    }

    setLastFinished(lastFinishedBook)
    setSimilar(similarBooks)
    setFriendsReading(friendsRows)
    setPopularInClubs(popularInClubsRows)
    setStaffPicks((staffRes.data ?? []) as SupaBook[])
    setAwardWinners((awardRows ?? []) as SupaBook[])
    setAdaptations((adaptRes.data ?? []) as SupaBook[])
    setActiveClubs(activeClubsRows)
    setTrending(trendingRows)
    setHiddenGems(hiddenGemsRows)
    setNewAdditions(newAdditionsRows)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useFocusEffect(useCallback(() => {
    load()
  }, [load]))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const fetchRecs = useCallback(async () => {
    if (!viewerId || recsBusy) return
    setRecsBusy(true)
    try {
      const out = await getAIRecommendations(viewerId)
      setRecs(out)
    } finally {
      setRecsBusy(false)
    }
  }, [recsBusy, viewerId])

  // First-load AI recs once we know who the viewer is + they have history.
  useEffect(() => {
    if (recs !== null) return
    if (!viewerId) return
    if (!lastFinished && friendsReading.length === 0) return
    fetchRecs()
  }, [fetchRecs, friendsReading.length, lastFinished, recs, viewerId])

  const handleSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const response = await searchGutenberg(q)
      setSearchResults(response.results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [query])

  // ── Render ───────────────────────────────────────────────────────────────

  const isSearching = query.trim().length > 0

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brandUi}
          />
        }
      >
        <View className="px-4 pt-2 pb-3">
          <View className="flex-row items-center justify-between" style={{ marginBottom: 12 }}>
            <Text
              style={{ fontFamily: Fonts.displayBold, fontSize: 22, color: colors.textPrimary }}
            >
              Discover
            </Text>
            <Pressable
              onPress={() => router.push('/search' as never)}
              hitSlop={10}
              accessibilityLabel="Search"
              style={{ padding: 6 }}
            >
              <MagnifyingGlass color={colors.textPrimary} size={20} />
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder="Search for books or authors"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
            style={{
              fontFamily: Fonts.body,
              fontSize: 15,
              color: colors.textPrimary,
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />
        </View>

        {isSearching ? (
          <View className="px-4">
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 11,
                color: colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 10,
              }}
            >
              {searching ? 'Searching…' : `Results for "${query}"`}
            </Text>
            {searching ? (
              <ActivityIndicator color={colors.brandUi} />
            ) : (
              <View className="flex-row flex-wrap justify-between">
                {searchResults.map((b) => (
                  <BookCard key={b.id} book={b} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <>
            {loading ? (
              <ActivityIndicator color={colors.brandUi} style={{ marginTop: 24 }} />
            ) : null}

            {/* Today's Pick, rotates daily from the curated pool. Falls
                back gracefully if nothing has loaded yet. */}
            {todaysPick ? (
              <TodaysPickHero
                book={todaysPick}
                onOpen={() => router.push(`/book/${todaysPick.id}` as never)}
              />
            ) : null}

            {/* Mood chips */}
            <ChipRow
              title="What are you in the mood for?"
              values={MOODS}
              onPress={(v) => router.push(`/discover/filter?type=mood&value=${encodeURIComponent(v)}` as never)}
            />

            {/* "What are you in the mood for?" entry, prominent so users
                find the AI recommendation flow. */}
            <View style={{ marginTop: 12 }}>
              <Pressable
                onPress={() => router.push('/find-next-book' as never)}
                accessibilityRole="button"
                accessibilityLabel="What are you in the mood for?"
                className="mx-4 p-3 rounded-2xl flex-row items-center justify-between"
                style={{ backgroundColor: colors.brandSubtle }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.brandSubtleText }}
                  >
                    What are you in the mood for?
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 12,
                      color: colors.brandSubtleText,
                      marginTop: 2,
                      opacity: 0.85,
                    }}
                  >
                    Find your next book →
                  </Text>
                </View>
                <Sparkle color={colors.brandSubtleText} size={18} />
              </Pressable>
            </View>

            {staffPicks.length > 0 ? (
              <SectionRow
                title="Staff picks"
                books={staffPicks}
                onPressBook={(id) => router.push(`/book/${id}` as never)}
              />
            ) : null}

            {friendsReading.length > 0 ? (
              <SectionRow
                title="Your friends are reading"
                books={friendsReading}
                onPressBook={(id) => router.push(`/book/${id}` as never)}
              />
            ) : null}

            {trending.length > 0 ? (
              <SectionRow
                title="Popular this week"
                books={trending}
                onPressBook={(id) => router.push(`/book/${id}` as never)}
              />
            ) : null}

            {/* Browse by ▾, collapsed by default; reveals Era/Length/Theme/
                Country chip rows. Cleaner default, discoverable for those
                who want it. */}
            <BrowseBy
              eras={ERAS}
              lengths={LENGTHS}
              themes={THEMES}
              countries={COUNTRIES}
              onPick={(type, value) =>
                router.push(`/discover/filter?type=${type}&value=${encodeURIComponent(value)}` as never)
              }
            />

            {activeClubs.length > 0 ? (
              <SectionWrap title="Clubs looking for readers">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
                >
                  {activeClubs.slice(0, 3).map((c) => (
                    <ClubMiniCard
                      key={c.id}
                      club={c}
                      onPress={() => router.push(`/clubs/${c.id}` as never)}
                    />
                  ))}
                </ScrollView>
              </SectionWrap>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────

