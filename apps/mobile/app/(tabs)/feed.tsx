import { useDiscover, useFeedPages, useNotifications } from '@foxing/client'
import { View, FlatList, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Newspaper } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { authClient } from '@/lib/api'
import { FeedRow } from '@/components/feed/feed-row'
import {
  FeedEmptyState,
  FeedHeader,
  FeedListEmpty,
  FeedListFooter,
  PopularSection,
} from '@/components/feed/feed-sections'

// The activity feed: GET /feed page by page (the same rows the web feed shows), with
// the catalog's trending books on top so a reader who follows no one still has
// something to open.
export default function FeedScreen() {
  const colors = useColors()
  const router = useRouter()
  const session = authClient.useSession()
  const signedIn = !!session.data
  const feed = useFeedPages()
  const notifications = useNotifications()
  const trending = useDiscover().data?.trending.slice(0, 8) ?? []
  const unread = signedIn ? (notifications.data?.unread ?? 0) : 0
  const rows = feed.data?.pages.flatMap((p) => p.rows) ?? []
  const openBell = () => router.push('/notifications' as never)

  if (!signedIn && !session.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
        <FeedHeader unread={0} onBell={openBell} />
        <FeedEmptyState
          icon={<Newspaper color={colors.brandSubtleText} size={32} weight="regular" />}
          title="Sign in to see your feed"
          body="Once you're signed in and following other readers, their activity will appear here."
        />
      </SafeAreaView>
    )
  }

  if (feed.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
        <FeedHeader unread={unread} onBell={openBell} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <FeedHeader unread={unread} onBell={openBell} />
      <FlatList
        ListHeaderComponent={
          <PopularSection
            showFindReaders={rows.length < 5}
            onFindReaders={() => router.push('/discover-readers' as never)}
            trending={trending}
            onPressBook={(slug) => router.push(`/book/${slug}` as never)}
            sectionLabel={rows.length > 0 ? 'From people you follow' : null}
          />
        }
        data={rows}
        keyExtractor={(row) => `${row.kind}:${row.id}`}
        renderItem={({ item }) => (
          <FeedRow
            row={item}
            onOpenActor={(username) => router.push(`/u/${username}` as never)}
            onOpenBook={(slug) => router.push(`/book/${slug}` as never)}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 64 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={() => {
              void feed.refetch()
              void notifications.refetch()
            }}
            tintColor={colors.brandUi}
            colors={[colors.brandUi]}
          />
        }
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage()
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <FeedListEmpty error={feed.isError ? "Check your connection and pull to try again." : null} />
        }
        ListFooterComponent={
          <FeedListFooter
            loadingMore={feed.isFetchingNextPage}
            hasMore={!!feed.hasNextPage}
            count={rows.length}
          />
        }
      />
    </SafeAreaView>
  )
}
