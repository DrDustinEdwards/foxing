import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft, BookOpen } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

type FilterType = 'mood' | 'era' | 'length' | 'theme' | 'country'

interface Row {
  id: string
  title: string
  author: string
  cover_url: string | null
}

// Heuristic mappings, books table doesn't carry a mood column, so we
// query the `subjects` text[] with a small set of seed keywords per mood.
const MOOD_SUBJECTS: Record<string, string[]> = {
  Dark: ['Gothic', 'Horror', 'Tragedies', 'Crime', 'Detective and mystery'],
  Uplifting: ['Friendship', 'Comedy', 'Coming of age', 'Children'],
  Adventurous: ['Adventure', 'Sea stories', 'Voyages', 'Exploration'],
  Romantic: ['Love stories', 'Romance', 'Courtship'],
  Mysterious: ['Detective and mystery', 'Suspense', 'Conspiracy'],
  Philosophical: ['Philosophy', 'Ethics', 'Metaphysics'],
  Funny: ['Humorous stories', 'Satire', 'Comedy'],
  Heartbreaking: ['Tragedies', 'Grief', 'Bereavement'],
}

// Subject keywords for eras, Gutendex sometimes tags works with these.
const ERA_SUBJECTS: Record<string, string[]> = {
  'Ancient': ['Ancient', 'Classical literature'],
  'Medieval': ['Medieval', 'Middle Ages'],
  '1700s': ['Eighteenth century', '18th century'],
  '1800s': ['Nineteenth century', 'Victorian', '19th century'],
  'Early 1900s': ['Twentieth century', 'World War, 1914-1918'],
  'Mid 1900s': ['Twentieth century', 'World War, 1939-1945'],
}

// Theme keywords, common literary themes mapped to Gutendex subject seeds.
const THEME_SUBJECTS: Record<string, string[]> = {
  'Love': ['Love stories', 'Romance', 'Courtship', 'Marriage'],
  'War': ['War stories', 'War', 'Soldiers', 'World War'],
  'Family': ['Family', 'Domestic fiction', 'Mothers', 'Fathers'],
  'Identity': ['Identity', 'Self-realization', 'Coming of age'],
  'Justice': ['Justice', 'Trials', 'Law', 'Crime'],
  'Nature': ['Nature', 'Wilderness', 'Animals', 'Natural history'],
  'Power': ['Politics', 'Government', 'Tyranny', 'Revolution'],
  'Death': ['Death', 'Grief', 'Mourning', 'Tragedies'],
  'Faith': ['Religion', 'Christianity', 'Faith', 'Spirituality'],
  'Class': ['Social classes', 'Poor', 'Rich', 'Class consciousness'],
}

// Country/region keywords, author nationality or setting subject tags.
const COUNTRY_SUBJECTS: Record<string, string[]> = {
  'England': ['English literature', 'England', 'London', 'Britain'],
  'France': ['French literature', 'France', 'Paris'],
  'Russia': ['Russian literature', 'Russia', 'Moscow', 'St. Petersburg'],
  'United States': ['American literature', 'United States', 'New York', 'New England'],
  'Germany': ['German literature', 'Germany', 'Berlin'],
  'Japan': ['Japanese literature', 'Japan', 'Tokyo'],
  'Spain': ['Spanish literature', 'Spain', 'Madrid'],
  'Italy': ['Italian literature', 'Italy', 'Rome', 'Florence'],
  'Ireland': ['Irish literature', 'Ireland', 'Dublin'],
  'India': ['Indian literature', 'India', 'Bengal'],
}

// Word-count buckets, approx pages × 250 wpm.
const LENGTH_RANGES: Record<string, { min: number | null; max: number | null }> = {
  short: { min: null, max: 12500 },
  novella: { min: 12500, max: 37500 },
  novel: { min: 37500, max: 100_000 },
  long: { min: 100_000, max: null },
}

export default function DiscoverFilterScreen() {
  const colors = useColors()
  const router = useRouter()
  const { type, value } = useLocalSearchParams<{ type: FilterType; value: string }>()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!type || !value) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    let query = supabase.from('books').select('id, title, author, cover_url').limit(60)
    if (type === 'mood' || type === 'era' || type === 'theme' || type === 'country') {
      const table =
        type === 'mood' ? MOOD_SUBJECTS
        : type === 'era' ? ERA_SUBJECTS
        : type === 'theme' ? THEME_SUBJECTS
        : COUNTRY_SUBJECTS
      const subjects = table[value]
      if (subjects && subjects.length > 0) {
        // Postgrest .or() with array-contains for any of the seeds.
        const clauses = subjects.map((s) => `subjects.cs.{${escapeForOr(s)}}`).join(',')
        query = query.or(clauses)
      }
    } else if (type === 'length') {
      const range = LENGTH_RANGES[value]
      if (range) {
        if (range.min !== null) query = query.gte('word_count', range.min)
        if (range.max !== null) query = query.lt('word_count', range.max)
        // Books missing word_count would otherwise be excluded by gte/lt; that's
        // acceptable for a coarse length filter.
      }
    }
    const { data, error } = await query
    if (error) console.warn('[discover/filter]', error.message)
    setRows((data ?? []) as Row[])
    setLoading(false)
  }, [type, value])

  useEffect(() => {
    load()
  }, [load])

  const title =
    type === 'length'
      ? value === 'short' ? 'Short stories'
        : value === 'novella' ? 'Novellas'
        : value === 'novel' ? 'Novels'
        : 'Long novels'
      : (value ?? '')

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{
            fontFamily: Fonts.display,
            fontSize: 18,
            color: colors.textPrimary,
            marginLeft: 4,
          }}
        >
          {title}
        </Text>
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textTertiary,
              textAlign: 'center',
            }}
          >
            Nothing matches yet. Try a different filter or ingest more books.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(b) => b.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          columnWrapperStyle={{ gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/book/${item.id}` as never)}
              style={{ flex: 1, maxWidth: '48%' }}
            >
              <View
                style={{
                  aspectRatio: 2 / 3,
                  borderRadius: 6,
                  overflow: 'hidden',
                  backgroundColor: colors.bgSunken,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                {item.cover_url ? (
                  <Image
                    source={{ uri: item.cover_url }}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <BookOpen color={colors.textTertiary} size={22} />
                )}
              </View>
              <Text
                style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <Text
                style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}
                numberOfLines={1}
              >
                {item.author}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  )
}

// Postgrest's .or() takes a comma-separated list; commas and parens inside
// values would break the expression. Strip them.
function escapeForOr(s: string): string {
  return s.replace(/[(),]/g, ' ')
}
