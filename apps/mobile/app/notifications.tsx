import { useMarkNotificationsRead, useNotifications } from '@foxing/client'
import type * as W from '@foxing/types'
import { useCallback, useMemo } from 'react'
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, UserPlus, ChatCircleDots, Heart, Trophy, Bell, UsersThree, CalendarBlank, ChartBar, Megaphone } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/relative-time'

type BucketKey = 'today' | 'week' | 'earlier'
const BUCKETS: Array<{ key: BucketKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'earlier', label: 'Earlier' },
]

// GET /notifications. Opening one marks it read in the cache straight away.
export default function NotificationsScreen() {
  const colors = useColors()
  const router = useRouter()
  const notifications = useNotifications()
  const markRead = useMarkNotificationsRead()
  const rows = notifications.data?.notifications ?? []
  const unreadCount = notifications.data?.unread ?? 0

  const onTap = useCallback(
    (n: W.NotificationItem) => {
      if (!n.isRead) markRead.fire({ ids: [n.id] })
      const route = notificationRoute(n)
      if (route) router.push(route as never)
    },
    [markRead, router],
  )

  const onMarkAll = useCallback(() => markRead.fire(), [markRead])

  const buckets = useMemo(() => groupByBucket(rows), [rows])

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
            flex: 1,
          }}
        >
          Notifications
        </Text>
        {unreadCount > 0 ? (
          <Pressable onPress={onMarkAll} hitSlop={8}>
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}>
              Mark all read
            </Text>
          </Pressable>
        ) : null}
      </View>

      {notifications.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={flattenBuckets(buckets)}
          keyExtractor={(item) =>
            item.kind === 'header' ? `h:${item.bucket}` : `n:${item.row.id}`
          }
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 11,
                  color: colors.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginTop: 16,
                  marginBottom: 6,
                  paddingHorizontal: 16,
                }}
              >
                {item.label}
              </Text>
            ) : (
              <NotificationRowView row={item.row} onPress={() => onTap(item.row)} />
            )
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={notifications.isRefetching}
              onRefresh={() => notifications.refetch()}
              tintColor={colors.brandUi}
              colors={[colors.brandUi]}
            />
          }
        />
      )}
    </SafeAreaView>
  )
}

function NotificationRowView({
  row,
  onPress,
}: {
  row: W.NotificationItem
  onPress: () => void
}) {
  const colors = useColors()
  const Icon = iconFor(row.type)
  const unread = !row.isRead
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-start mx-3 mb-2 p-3 rounded-2xl border"
      style={{
        borderColor: colors.borderSubtle,
        backgroundColor: unread ? colors.bgSelected : colors.bgSurface,
        borderLeftWidth: unread ? 3 : 1,
        borderLeftColor: unread ? colors.brandUi : colors.borderSubtle,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brandSubtle,
          marginRight: 12,
        }}
      >
        <Icon color={colors.brandSubtleText} size={18} weight="regular" />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
          numberOfLines={1}
        >
          {row.title}
        </Text>
        {row.body ? (
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 13,
              color: colors.textSecondary,
              marginTop: 2,
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {row.body}
          </Text>
        ) : null}
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 10, color: colors.textTertiary, marginTop: 4 }}
        >
          {relativeTime(row.createdAt)}
        </Text>
      </View>
    </Pressable>
  )
}

function EmptyState() {
  const colors = useColors()
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
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
        <Bell color={colors.brandSubtleText} size={28} weight="regular" />
      </View>
      <Text
        style={{
          fontFamily: Fonts.display,
          fontSize: 18,
          color: colors.textPrimary,
          textAlign: 'center',
        }}
      >
        You're all caught up.
      </Text>
    </View>
  )
}

function iconFor(type: string) {
  switch (type) {
    case 'new_follower':
      return UserPlus
    case 'thread_reply':
    case 'post_reply':
      return ChatCircleDots
    case 'reaction':
      return Heart
    case 'goal_met':
      return Trophy
    case 'club_request':
    case 'club_approval':
      return UsersThree
    case 'announcement':
      return Megaphone
    case 'poll':
      return ChartBar
    case 'meeting_reminder':
      return CalendarBlank
    default:
      return Bell
  }
}

// ── Grouping ─────────────────────────────────────────────────────────────

function groupByBucket(rows: W.NotificationItem[]): Record<BucketKey, W.NotificationItem[]> {
  const now = Date.now()
  const dayMs = 86_400_000
  const out: Record<BucketKey, W.NotificationItem[]> = { today: [], week: [], earlier: [] }
  for (const r of rows) {
    const age = now - r.createdAt
    if (age < dayMs) out.today.push(r)
    else if (age < dayMs * 7) out.week.push(r)
    else out.earlier.push(r)
  }
  return out
}

type ListItem =
  | { kind: 'header'; bucket: BucketKey; label: string }
  | { kind: 'row'; row: W.NotificationItem }

function flattenBuckets(buckets: Record<BucketKey, W.NotificationItem[]>): ListItem[] {
  const out: ListItem[] = []
  for (const b of BUCKETS) {
    const list = buckets[b.key]
    if (list.length === 0) continue
    out.push({ kind: 'header', bucket: b.key, label: b.label })
    for (const r of list) out.push({ kind: 'row', row: r })
  }
  return out
}

// Where a notification leads, from the ids the server puts in its data.
function notificationRoute(n: W.NotificationItem): string | null {
  const str = (k: string) => (typeof n.data[k] === 'string' ? (n.data[k] as string) : null)
  switch (n.type) {
    case 'thread_reply':
    case 'post_reply':
    case 'announcement': {
      const threadId = str('threadId')
      return threadId ? `/clubs/thread/${threadId}` : null
    }
    case 'club_approval':
      return '/(tabs)/clubs'
    case 'new_follower':
      return '/follows'
    case 'goal_met':
      return '/goals'
    case 'reaction': {
      const target = str('targetId')
      return str('targetType') === 'reading_list' && target ? `/lists/${target}` : null
    }
    default:
      return null
  }
}
