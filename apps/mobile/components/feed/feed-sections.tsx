import type * as W from '@foxing/types'
import { useColors } from '@/constants/colors'
import { useRouter } from 'expo-router'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { Bell, Newspaper, UserPlus } from 'phosphor-react-native'
import { Fonts } from '@/constants/fonts'
import { TrendingBookCard } from '@/components/feed/trending-book-card'

export function FeedEmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  const colors = useColors()
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingTop: 80,
        paddingBottom: 64,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brandSubtle,
          marginBottom: 16,
        }}
      >
        {icon}
      </View>
      <Text
        style={{
          fontFamily: Fonts.display,
          fontSize: 18,
          color: colors.textPrimary,
          textAlign: 'center',
          marginBottom: 6,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: 14,
          color: colors.textTertiary,
          textAlign: 'center',
          lineHeight: 20,
        }}
      >
        {body}
      </Text>
    </View>
  )
}

export function FeedListEmpty({ error }: { error: string | null }) {
  const colors = useColors()
  if (error) {
    return (
      <FeedEmptyState
        icon={<Newspaper color={colors.error} size={32} weight="regular" />}
        title="Couldn't load feed"
        body={error}
      />
    )
  }
  return (
    <FeedEmptyState
      icon={<Newspaper color={colors.brandSubtleText} size={32} weight="regular" />}
      title="Your feed is quiet"
      body="Follow other readers to see their reviews, finishes and lists here."
    />
  )
}

export function FeedListFooter({
  loadingMore,
  hasMore,
  count,
}: {
  loadingMore: boolean
  hasMore: boolean
  count: number
}) {
  const colors = useColors()
  if (loadingMore) {
    return (
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <ActivityIndicator color={colors.brandUi} />
      </View>
    )
  }
  if (!hasMore && count > 0) {
    return (
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>
          You're all caught up.
        </Text>
      </View>
    )
  }
  return null
}

export function FeedHeader({ unread, onBell }: { unread: number; onBell: () => void }) {
  const colors = useColors()
  const router = useRouter()
  return (
    <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
      <Text style={{ fontFamily: Fonts.displayBold, fontSize: 22, color: colors.textPrimary }}>
        Feed
      </Text>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <Pressable
          onPress={() => router.push('/discover-readers' as never)}
          hitSlop={6}
          accessibilityLabel="Find readers"
          className="px-3 py-1 rounded-full border"
          style={{ borderColor: colors.borderSubtle }}
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.textPrimary,
            }}
          >
            Find readers
          </Text>
        </Pressable>
        <Pressable
          onPress={onBell}
          hitSlop={10}
          accessibilityLabel="Notifications"
          style={{ padding: 4 }}
        >
          <Bell color={colors.textPrimary} size={22} weight="regular" />
          {unread > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: colors.brandUi,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 9,
                  color: colors.textOnBrand,
                }}
              >
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  )
}

// "Popular on Foxing this month" + optional Find Readers card. Always rendered
// as the FlatList header so the feed has content even when the user follows
// no one.
export function PopularSection({
  showFindReaders,
  onFindReaders,
  trending,
  onPressBook,
  sectionLabel,
}: {
  showFindReaders: boolean
  onFindReaders: () => void
  trending: W.BookCard[]
  onPressBook: (slug: string) => void
  sectionLabel: string | null
}) {
  const colors = useColors()
  return (
    <View style={{ marginBottom: 12 }}>
      {showFindReaders ? (
        <Pressable
          onPress={onFindReaders}
          accessibilityRole="button"
          accessibilityLabel="Find readers like you"
          className="flex-row items-center p-4 mb-3 rounded-2xl border"
          style={{
            backgroundColor: colors.brandSubtle,
            borderColor: colors.borderBrand,
            gap: 12,
          }}
        >
          <UserPlus color={colors.brandSubtleText} size={20} />
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.brandSubtleText }}
            >
              Find readers like you
            </Text>
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 12,
                color: colors.brandSubtleText,
                opacity: 0.85,
                marginTop: 2,
              }}
            >
              We'll fill your feed once you follow a few people.
            </Text>
          </View>
        </Pressable>
      ) : null}

      <SectionLabel>Popular on Foxing this month</SectionLabel>
      {trending.length === 0 ? (
        <View
          className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          <Text
            style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textTertiary }}
          >
            Check back in a day, the community's still warming up.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 12 }}
        >
          {trending.map((b) => (
            <TrendingBookCard key={b.id} book={b} onPress={onPressBook} />
          ))}
        </ScrollView>
      )}

      {sectionLabel ? (
        <View style={{ marginTop: 18, marginBottom: 6 }}>
          <SectionLabel>{sectionLabel}</SectionLabel>
        </View>
      ) : null}
    </View>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
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
      {children}
    </Text>
  )
}
