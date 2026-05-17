import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, Trophy, Check, ShareNetwork } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// 16-genre 4x4 grid. The matching is intentionally loose, case-insensitive
// substring against books.subjects (Gutendex subjects are long phrases).
const GENRES_4X4: string[] = [
  'Adventure',
  'Mystery',
  'Romance',
  'Gothic',
  'Science Fiction',
  'Philosophy',
  'Poetry',
  'Historical',
  'Fairy tales',
  'Satire',
  'Tragedy',
  'Comedy',
  'Biography',
  'Short stories',
  'Religious',
  'Children',
]

interface MatchedCell {
  genre: string
  matched: boolean
  example?: { title: string; author: string } | null
}

const LINES: number[][] = [
  // rows
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
  // columns
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
  // diagonals
  [0, 5, 10, 15], [3, 6, 9, 12],
]

export default function GenreBingoScreen() {
  const colors = useColors()
  const router = useRouter()
  const [cells, setCells] = useState<MatchedCell[]>([])
  const [loading, setLoading] = useState(true)
  const [bingoCount, setBingoCount] = useState(0)
  const [justAwarded, setJustAwarded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setCells(GENRES_4X4.map((g) => ({ genre: g, matched: false })))
      setLoading(false)
      return
    }
    // Pull all finished books with subjects in one round-trip.
    const { data } = await supabase
      .from('user_books')
      .select('book:books(title, author, subjects)')
      .eq('user_id', user.id)
      .eq('status', 'finished')
    type R = {
      book: { title: string; author: string; subjects: string[] | null }
        | Array<{ title: string; author: string; subjects: string[] | null }>
        | null
    }
    const books = (((data ?? []) as unknown) as R[])
      .map((r) => (Array.isArray(r.book) ? r.book[0] : r.book))
      .filter((b): b is NonNullable<typeof b> => !!b)
    // Match each genre cell against any finished book whose subjects
    // contain the genre (case-insensitive substring).
    const matched: MatchedCell[] = GENRES_4X4.map((g) => {
      const lower = g.toLowerCase()
      const book = books.find((b) =>
        (b.subjects ?? []).some((s) => s.toLowerCase().includes(lower)),
      )
      return {
        genre: g,
        matched: !!book,
        example: book ? { title: book.title, author: book.author } : null,
      }
    })
    setCells(matched)
    const count = countCompletedLines(matched)
    setBingoCount(count)
    if (count > 0) {
      // Award the genre_bingo badge, idempotent insert.
      const { data: badge } = await supabase
        .from('badges')
        .select('id')
        .eq('slug', 'genre_bingo')
        .maybeSingle()
      if (badge) {
        const { data: existing } = await supabase
          .from('user_badges')
          .select('badge_id')
          .eq('user_id', user.id)
          .eq('badge_id', (badge as { id: string }).id)
          .maybeSingle()
        if (!existing) {
          await supabase
            .from('user_badges')
            .insert({ user_id: user.id, badge_id: (badge as { id: string }).id })
          setJustAwarded(true)
        }
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const completedLines = useMemo(() => {
    const indices = new Set<number>()
    for (const line of LINES) {
      if (line.every((i) => cells[i]?.matched)) {
        for (const i of line) indices.add(i)
      }
    }
    return indices
  }, [cells])

  const share = useCallback(async () => {
    const matched = cells.filter((c) => c.matched).length
    try {
      await Share.share({
        message: `Genre Bingo on Foxing: ${matched}/16 genres covered${bingoCount > 0 ? `, ${bingoCount} bingo${bingoCount === 1 ? '' : 's'}` : ''}.`,
      })
    } catch {
      /* user cancelled */
    }
  }, [bingoCount, cells])

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }

  const matchedCount = cells.filter((c) => c.matched).length

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 18,
            color: colors.textPrimary,
            marginLeft: 4,
            flex: 1,
          }}
        >
          Genre Bingo
        </Text>
        <Pressable onPress={share} hitSlop={10} style={{ padding: 6 }}>
          <ShareNetwork color={colors.textPrimary} size={18} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View
          className="flex-row items-center justify-between p-3 mb-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          <View>
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
              {matchedCount} of 16 cells covered
            </Text>
            <Text
              style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}
            >
              {bingoCount > 0
                ? `${bingoCount} completed bingo line${bingoCount === 1 ? '' : 's'}`
                : 'Complete a row, column, or diagonal for the Genre Bingo badge.'}
            </Text>
          </View>
          <Trophy
            color={bingoCount > 0 ? colors.brandUi : colors.textTertiary}
            size={28}
            weight={bingoCount > 0 ? 'fill' : 'regular'}
          />
        </View>

        {justAwarded ? (
          <View
            className="p-3 mb-4 rounded-xl"
            style={{ backgroundColor: colors.successBg }}
          >
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.success }}>
              Genre Bingo badge unlocked!
            </Text>
          </View>
        ) : null}

        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {cells.map((c, i) => {
            const inLine = completedLines.has(i)
            return (
              <View
                key={c.genre}
                style={{
                  width: '23.5%',
                  aspectRatio: 1,
                  borderRadius: 10,
                  padding: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: c.matched
                    ? inLine ? colors.brandUi : colors.bgSelected
                    : colors.bgSurface,
                  borderWidth: 1,
                  borderColor: inLine
                    ? colors.brandUi
                    : c.matched
                      ? colors.borderBrand
                      : colors.borderSubtle,
                }}
              >
                {c.matched ? (
                  <Check
                    color={inLine ? colors.textOnBrand : colors.brandText}
                    size={14}
                    weight="bold"
                  />
                ) : null}
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 10,
                    color: c.matched
                      ? inLine ? colors.textOnBrand : colors.brandText
                      : colors.textSecondary,
                    textAlign: 'center',
                    marginTop: 2,
                  }}
                  numberOfLines={2}
                >
                  {c.genre}
                </Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function countCompletedLines(cells: MatchedCell[]): number {
  let n = 0
  for (const line of LINES) {
    if (line.every((i) => cells[i]?.matched)) n += 1
  }
  return n
}
