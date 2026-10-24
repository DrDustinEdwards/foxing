import { keys, useDiscover, useRecommendations } from '@foxing/client'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { MagnifyingGlass, Sparkle } from 'phosphor-react-native'
import { useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  BrowseBy,
  ChipRow,
  ClubMiniCard,
  SectionRow,
  SectionWrap,
  TodaysPickHero,
} from '@/components/discover/discover-sections'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export default function Discover() {
  const colors = useColors()
  const router = useRouter()
  const queryClient = useQueryClient()
  const discover = useDiscover()
  const recs = useRecommendations()
  const [refreshing, setRefreshing] = useState(false)

  const openBook = (slug: string) => router.push(`/book/${slug}` as never)
  const openFilter = (type: 'subject' | 'era' | 'length', value: string, label: string) =>
    router.push(
      `/discover/filter?type=${type}&value=${encodeURIComponent(value)}&label=${encodeURIComponent(label)}` as never,
    )

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.discover }),
      queryClient.invalidateQueries({ queryKey: keys.recommendations }),
    ])
    setRefreshing(false)
  }

  const page = discover.data
  const recommended = recs.data?.recommendations ?? []

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandUi} />
        }
      >
        <View className="px-4 pt-2 pb-3">
          <Text style={{ fontFamily: Fonts.displayBold, fontSize: 22, color: colors.textPrimary, marginBottom: 12 }}>
            Discover
          </Text>
          <Pressable
            onPress={() => router.push('/search' as never)}
            accessibilityRole="search"
            accessibilityLabel="Search for books or authors"
            className="flex-row items-center"
            style={{
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              gap: 8,
            }}
          >
            <MagnifyingGlass color={colors.textTertiary} size={16} />
            <Text style={{ fontFamily: Fonts.body, fontSize: 15, color: colors.textTertiary }}>
              Search for books or authors
            </Text>
          </Pressable>
        </View>

        {discover.isPending ? <ActivityIndicator color={colors.brandUi} style={{ marginTop: 24 }} /> : null}
        {discover.isError ? (
          <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textSecondary, marginHorizontal: 16 }}>
            Couldn't load Discover. Pull down to try again.
          </Text>
        ) : null}

        {page?.todaysPick ? (
          <TodaysPickHero book={page.todaysPick.book} onOpen={() => openBook(page.todaysPick!.book.slug)} />
        ) : null}

        {page && page.genres.length > 0 ? (
          <ChipRow
            title="Browse by genre"
            values={page.genres.map((g) => g.subject)}
            onPress={(subject) => openFilter('subject', subject, subject)}
          />
        ) : null}

        <View style={{ marginTop: 12 }}>
          <Pressable
            onPress={() => router.push('/find-next-book' as never)}
            accessibilityRole="button"
            accessibilityLabel="What are you in the mood for?"
            className="mx-4 p-3 rounded-2xl flex-row items-center justify-between"
            style={{ backgroundColor: colors.brandSubtle }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.brandSubtleText }}>
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

        {recommended.length > 0 ? (
          <SectionRow title="Recommended for you" books={recommended} onPressBook={openBook} />
        ) : null}
        {page && page.staffPicks.length > 0 ? (
          <SectionRow title="Staff picks" books={page.staffPicks} onPressBook={openBook} />
        ) : null}
        {page && page.trending.length > 0 ? (
          <SectionRow title="Popular this month" books={page.trending} onPressBook={openBook} />
        ) : null}
        {page && page.awardWinners.length > 0 ? (
          <SectionRow title="Award winners" books={page.awardWinners} onPressBook={openBook} />
        ) : null}
        {page && page.newest.length > 0 ? (
          <SectionRow title="New to Foxing" books={page.newest} onPressBook={openBook} />
        ) : null}

        {page ? (
          <BrowseBy
            eras={page.eras}
            lengths={page.lengths}
            onPick={(type, slug, label) => openFilter(type, slug, label)}
          />
        ) : null}

        {page && page.clubs.length > 0 ? (
          <SectionWrap title="Clubs to join">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            >
              {page.clubs.map((c) => (
                <ClubMiniCard key={c.id} club={c} onPress={() => router.push(`/clubs/${c.id}` as never)} />
              ))}
            </ScrollView>
          </SectionWrap>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}
