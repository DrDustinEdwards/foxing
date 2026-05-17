import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, MagnifyingGlass } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { authorSlug } from '@/lib/book-ai'

interface AuthorRow {
  author: string
  count: number
}

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export default function AuthorsScreen() {
  const colors = useColors()
  const router = useRouter()
  const [authors, setAuthors] = useState<AuthorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [letter, setLetter] = useState<string>('')

  useEffect(() => {
    let cancel = false
    ;(async () => {
      // Distinct authors with book counts. PostgREST can't group easily here,
      // so we pull a bounded slice and aggregate client-side. 2,000 covers
      // virtually all of Foxing's curated catalog.
      const { data } = await supabase
        .from('books')
        .select('author')
        .order('author', { ascending: true })
        .limit(2000)
      if (cancel) return
      const counts = new Map<string, number>()
      for (const r of (data ?? []) as Array<{ author: string | null }>) {
        const a = (r.author ?? '').trim()
        if (!a) continue
        counts.set(a, (counts.get(a) ?? 0) + 1)
      }
      const rows: AuthorRow[] = [...counts.entries()]
        .map(([author, count]) => ({ author, count }))
        .sort((a, b) => a.author.localeCompare(b.author))
      setAuthors(rows)
      setLoading(false)
    })()
    return () => {
      cancel = true
    }
  }, [])

  const filtered = useMemo(() => {
    let rows = authors
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) => r.author.toLowerCase().includes(q))
    }
    if (letter) {
      rows = rows.filter((r) => {
        const lastName = lastNameOf(r.author)
        const first = (lastName[0] ?? '').toUpperCase()
        if (letter === '#') return !/[A-Z]/.test(first)
        return first === letter
      })
    }
    return rows
  }, [authors, query, letter])

  const openAuthor = useCallback(
    (name: string) => {
      router.push(`/author/${authorSlug(name)}?name=${encodeURIComponent(name)}` as never)
    },
    [router],
  )

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
          Authors
        </Text>
      </View>

      <View className="px-4 pb-2">
        <View
          className="flex-row items-center"
          style={{
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
          }}
        >
          <MagnifyingGlass color={colors.textTertiary} size={16} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Filter authors"
            placeholderTextColor={colors.textTertiary}
            style={{
              flex: 1,
              marginLeft: 8,
              paddingVertical: 10,
              fontFamily: Fonts.body,
              fontSize: 15,
              color: colors.textPrimary,
            }}
          />
        </View>
      </View>

      {/* A–Z scrubber */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 4, paddingBottom: 6 }}
      >
        {ALPHABET.map((l) => {
          const active = letter === l
          return (
            <Pressable
              key={l}
              onPress={() => setLetter(active ? '' : l)}
              hitSlop={4}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: active ? colors.bgSelected : 'transparent',
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 12,
                  color: active ? colors.brandText : colors.textTertiary,
                }}
              >
                {l}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.author}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
          ItemSeparatorComponent={() => (
            <View
              style={{ height: 1, backgroundColor: colors.borderSubtle, opacity: 0.5 }}
            />
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openAuthor(item.author)}
              className="py-3 flex-row items-center justify-between"
            >
              <Text
                style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textPrimary, flex: 1 }}
                numberOfLines={1}
              >
                {item.author}
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.mono,
                  fontSize: 11,
                  color: colors.textTertiary,
                  marginLeft: 8,
                }}
              >
                {item.count} book{item.count === 1 ? '' : 's'}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  )
}

// "Last, First" → "Last"; "First Last" → "Last"; single token → token.
function lastNameOf(name: string): string {
  const trimmed = name.trim()
  const comma = trimmed.indexOf(',')
  if (comma > 0) return trimmed.slice(0, comma).trim()
  const parts = trimmed.split(/\s+/)
  return parts[parts.length - 1] ?? trimmed
}
