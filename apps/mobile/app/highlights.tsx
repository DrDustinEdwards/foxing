import { useMyAnnotations } from '@foxing/client'
import { useCallback } from 'react'
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
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// Every highlight the reader has made, newest first, from GET /annotations.
export default function HighlightsScreen() {
  const colors = useColors()
  const router = useRouter()
  const highlights = useMyAnnotations(['highlight'])
  const rows = highlights.data ?? []
  const loading = highlights.isPending

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
              {highlights.error
                ? 'Could not load your highlights.'
                : "You haven't saved any highlights yet. Long press a passage while reading to capture one."}
            </Text>
          </View>
        ) : (
          rows.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => {
                if (h.bookId) router.push(`/reader/${h.bookId}`)
              }}
              onLongPress={() => {
                if (!h.bookId || !h.selectedText) return
                router.push(
                  `/quote-card?bookId=${h.bookId}&bookTitle=${encodeURIComponent(h.bookTitle ?? '')}&author=${encodeURIComponent(h.bookAuthor ?? '')}&passageText=${encodeURIComponent(h.selectedText)}` as never,
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
                  {h.selectedText}
                </Text>
                {h.body ? (
                  <Text
                    style={{
                      fontFamily: Fonts.bodyItalic,
                      fontSize: 13,
                      color: colors.textSecondary,
                      marginTop: 6,
                    }}
                  >
                    “{h.body}”
                  </Text>
                ) : null}
                <View
                  className="flex-row items-center justify-between"
                  style={{ marginTop: 8 }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: Fonts.ui,
                      fontSize: 11,
                      color: colors.textTertiary,
                    }}
                    numberOfLines={1}
                  >
                    {[h.bookTitle ?? h.sourceTitle, h.bookAuthor].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
