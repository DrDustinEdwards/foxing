import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface HighlightRow {
  id: string
  cfi: string
  text: string
  color: string | null
  note: string | null
  chapter: string | null
  created_at: string
  book: { id: string; title: string; author: string } | null
}

export default function HighlightsScreen() {
  const colors = useColors()
  const router = useRouter()
  const [rows, setRows] = useState<HighlightRow[]>([])
  const [loading, setLoading] = useState(true)

  const swatch = useCallback(
    (c: string | null) => {
      switch (c) {
        case 'amber': return colors.hlAmberT
        case 'auburn': return colors.hlAuburnT
        case 'yellow': return colors.hlYellowT
        case 'sage': return colors.hlSageT
        case 'cobalt': return colors.hlCobaltT
        case 'crimson': return colors.hlCrimsonT
        case 'purple': return colors.hlPurpleT
        default: return colors.borderDefault
      }
    },
    [colors]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) {
          setRows([])
          setLoading(false)
        }
        return
      }
      const { data } = await supabase
        .from('highlights')
        .select('id, cfi, text, color, note, chapter, created_at, book:books(id, title, author)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (cancelled) return
      setRows((data as unknown as HighlightRow[]) ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary, marginLeft: 4 }}
        >
          Highlights
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color={colors.brandUi} />
          </View>
        ) : rows.length === 0 ? (
          <View className="items-center py-16 px-8">
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 14,
                color: colors.textTertiary,
                textAlign: 'center',
              }}
            >
              You haven't saved any highlights yet. Long press a passage while
              reading to capture one.
            </Text>
          </View>
        ) : (
          rows.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => {
                if (h.book) router.push(`/reader/${h.book.id}`)
              }}
              onLongPress={() => {
                if (!h.book) return
                router.push(
                  `/quote-card?bookId=${h.book.id}&bookTitle=${encodeURIComponent(h.book.title)}&author=${encodeURIComponent(h.book.author)}&passageText=${encodeURIComponent(h.text)}` as never,
                )
              }}
              delayLongPress={350}
              className="mb-3 rounded-2xl flex-row overflow-hidden border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <View style={{ width: 4, backgroundColor: swatch(h.color) }} />
              <View style={{ flex: 1, padding: 14 }}>
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 15,
                    color: colors.textPrimary,
                    lineHeight: 22,
                  }}
                  numberOfLines={4}
                >
                  {h.text}
                </Text>
                {h.note ? (
                  <Text
                    style={{
                      fontFamily: Fonts.bodyItalic,
                      fontSize: 13,
                      color: colors.textSecondary,
                      marginTop: 6,
                    }}
                  >
                    “{h.note}”
                  </Text>
                ) : null}
                {h.book ? (
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 11,
                      color: colors.textTertiary,
                      marginTop: 8,
                    }}
                    numberOfLines={1}
                  >
                    {h.book.title} · {h.book.author}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
