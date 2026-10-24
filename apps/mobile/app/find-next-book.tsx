import { useRecommendations, useRefreshRecommendations, useSetBookStatus } from '@foxing/client'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Linking } from 'react-native'
import { Screen } from '@/components/ui/screen'
import { useRouter } from 'expo-router'
import { ArrowClockwise, CaretLeft } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// What to read next: GET /recommendations, the same picks and reasons as the web
// page (personalised by AI for Plus readers). Refresh asks for a fresh set.
export default function FindNextBookScreen() {
  const colors = useColors()
  const router = useRouter()
  const recs = useRecommendations()
  const refresh = useRefreshRecommendations()
  const setBookStatus = useSetBookStatus()
  const data = recs.data

  return (
    <Screen>
      <View className="flex-row items-center px-3 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="p-2"
        >
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            fontFamily: Fonts.displayBold,
            fontSize: 18,
            color: colors.textPrimary,
            marginLeft: 4,
          }}
        >
          Find Your Next Book
        </Text>
        <Pressable
          onPress={() => refresh.fire()}
          disabled={refresh.pending}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Refresh recommendations"
          className="p-2"
        >
          {refresh.pending ? (
            <ActivityIndicator color={colors.brandUi} />
          ) : (
            <ArrowClockwise color={colors.textPrimary} size={20} />
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {!data ? (
          recs.isError ? (
            <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.error }}>
              We couldn't load recommendations. Check your connection and try again.
            </Text>
          ) : (
            <ActivityIndicator color={colors.brandUi} />
          )
        ) : (
          <>
            <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textSecondary, marginBottom: 14 }}>
              {data.aiPersonalized
                ? 'Picks chosen for your reading, with a reason for each.'
                : 'Picks drawn from what you read and love, with a reason for each.'}
            </Text>
            {!data.isPlus ? (
              <Pressable
                onPress={() => Linking.openURL('https://foxing.app/pricing')}
                accessibilityRole="link"
                className="p-3 mb-4 rounded-2xl border"
                style={{ borderColor: colors.borderBrand, backgroundColor: colors.bgSelected }}
              >
                <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.brandText }}>
                  Plus tunes these to you with AI-personalized reasons.
                </Text>
              </Pressable>
            ) : null}
            {refresh.error ? (
              <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.error, marginBottom: 12 }}>
                {refresh.error}
              </Text>
            ) : null}
            {data.recommendations.length === 0 ? (
              <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textTertiary }}>
                No recommendations yet. Add a few books to your library and check back.
              </Text>
            ) : (
              data.recommendations.map((r) => (
                <View
                  key={r.bookId}
                  className="p-3 mb-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}>
                    {r.title}
                  </Text>
                  <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                    {r.author}
                    {r.publicationYear ? ` · ${r.publicationYear}` : ''}
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.bodyItalic,
                      fontSize: 13,
                      color: colors.textSecondary,
                      marginTop: 8,
                      lineHeight: 19,
                    }}
                  >
                    {r.reason}
                  </Text>
                  <View className="flex-row items-center justify-end" style={{ marginTop: 10, gap: 10 }}>
                    <Pressable
                      onPress={() =>
                        setBookStatus.fire({ bookId: r.bookId, status: 'want', book: { ...r, id: r.bookId } })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${r.title} to Want to Read`}
                      className="px-3 py-1 rounded-full border"
                      style={{ borderColor: colors.borderInteractive }}
                    >
                      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textPrimary }}>
                        Add to Want to Read
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push(`/book/${r.slug}` as never)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${r.title}`}
                      className="px-3 py-1 rounded-full"
                      style={{ backgroundColor: colors.brandUi }}
                    >
                      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textOnBrand }}>
                        Open
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}
