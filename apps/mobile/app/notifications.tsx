import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import {
  CaretLeft,
  UserPlus,
  ChatCircleDots,
  Heart,
  Trophy,
  BookOpen,
  Bell,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/feed'
import {
  type NotificationRow,
  listNotifications,
  markAllRead,
  markRead,
  notificationRoute,
} from '@/lib/notifications'

type BucketKey = 'today' | 'week' | 'earlier'
const BUCKETS: Array<{ key: BucketKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'earlier', label: 'Earlier' },
]

export default function NotificationsScreen() {
  const colors = useColors()
  const router = useRouter()
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [viewerId, setViewerId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setViewerId(user?.id ?? null)
    if (!user) {
      setRows([])
      setLoading(false)
      return
    }
    const list = await listNotifications(user.id)
    setRows(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const onTap = useCallback(
    async (n: NotificationRow) => {
      if (!n.read_at) {
        // Optimistic, flip locally so the badge feels responsive.
        setRows((prev) =>
          prev.map((r) => (r.id === n.id ? { ...r, read_at: new Date().toISOString() } : r)),
        )
        markRead(n.id).catch(() => {})
      }
      const route = notificationRoute(n)
      if (route) router.push(route as never)
    },
    [router],
  )

  const onMarkAll = useCallback(async () => {
    if (!viewerId) return
    setRows((prev) =>
      prev.map((r) => (r.read_at ? r : { ...r, read_at: new Date().toISOString() })),
    )
    await markAllRead(viewerId)
  }, [viewerId])

  const buckets = useMemo(() => groupByBucket(rows), [rows])
  const unreadCount = rows.filter((r) => !r.read_at).length

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

      {loading ? (
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
              refreshing={refreshing}
              onRefresh={onRefresh}
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
  row: NotificationRow
  onPress: () => void
}) {
  const colors = useColors()
  const Icon = iconFor(row.type)
  const unread = !row.read_at
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
          {relativeTime(row.created_at)}
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
    case 'passage_reply':
      return ChatCircleDots
    case 'post_reaction':
      return Heart
    case 'badge_earned':
      return Trophy
    case 'club_book_changed':
      return BookOpen
    default:
      return Bell
  }
}

// ── Grouping ─────────────────────────────────────────────────────────────

function groupByBucket(rows: NotificationRow[]): Record<BucketKey, NotificationRow[]> {
  const now = Date.now()
  const dayMs = 86_400_000
  const out: Record<BucketKey, NotificationRow[]> = { today: [], week: [], earlier: [] }
  for (const r of rows) {
    const age = now - new Date(r.created_at).getTime()
    if (age < dayMs) out.today.push(r)
    else if (age < dayMs * 7) out.week.push(r)
    else out.earlier.push(r)
  }
  return out
}

type ListItem =
  | { kind: 'header'; bucket: BucketKey; label: string }
  | { kind: 'row'; row: NotificationRow }

function flattenBuckets(buckets: Record<BucketKey, NotificationRow[]>): ListItem[] {
  const out: ListItem[] = []
  for (const b of BUCKETS) {
    const list = buckets[b.key]
    if (list.length === 0) continue
    out.push({ kind: 'header', bucket: b.key, label: b.label })
    for (const r of list) out.push({ kind: 'row', row: r })
  }
  return out
}
