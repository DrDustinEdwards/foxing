import { activityText } from '@foxing/client'
import type * as W from '@foxing/types'
import { Image, Pressable, Text, View } from 'react-native'
import { BookOpen, ChatCircle, CheckCircle, HighlighterCircle, ListBullets, Star, UserPlus, UsersThree } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/relative-time'

// One row of GET /feed: what someone you follow did, or a new follower of yours.
export function FeedRow({
  row,
  onOpenActor,
  onOpenBook,
}: {
  row: W.FeedRow
  onOpenActor: (username: string) => void
  onOpenBook: (slug: string) => void
}) {
  const colors = useColors()
  if (row.kind === 'follower') {
    return (
      <View
        className="flex-row items-center p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        style={{ gap: 10 }}
      >
        <UserPlus color={colors.brandText} size={16} />
        <Text style={{ flex: 1, fontFamily: Fonts.body, fontSize: 14, color: colors.textPrimary }}>
          {row.actorLabel}
        </Text>
        <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>
          {relativeTime(row.createdAt)}
        </Text>
      </View>
    )
  }
  const Icon = iconForType(row.type)
  const actor = row.actor
  const name = actor?.displayName ?? actor?.username ?? 'Someone'
  return (
    <View className="flex-row p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark">
      <Pressable
        onPress={() => actor && onOpenActor(actor.username)}
        hitSlop={4}
        accessibilityRole="link"
        accessibilityLabel={name}
      >
        <Avatar profile={actor} size={40} />
      </Pressable>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View className="flex-row items-center" style={{ marginBottom: 2 }}>
          <Icon color={colors.brandText} size={14} weight="regular" />
          <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginLeft: 6 }}>
            {relativeTime(row.createdAt)}
          </Text>
        </View>
        <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textPrimary, lineHeight: 20 }}>
          <Text
            onPress={() => actor && onOpenActor(actor.username)}
            style={{ fontFamily: Fonts.uiMedium }}
          >
            {name}
          </Text>{' '}
          {activityText(row)}
        </Text>
        {row.book ? (
          <Pressable
            onPress={() => row.book && onOpenBook(row.book.slug)}
            accessibilityRole="link"
            className="flex-row items-center mt-2"
            style={{ gap: 8 }}
          >
            {row.book.coverUrl ? (
              <Image
                source={{ uri: row.book.coverUrl }}
                style={{ width: 28, height: 42, borderRadius: 3, backgroundColor: colors.bgSunken }}
              />
            ) : null}
            <Text
              style={{ flex: 1, fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.brandText }}
              numberOfLines={1}
            >
              {row.book.title}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

export function Avatar({
  profile,
  size,
}: {
  profile: { avatarUrl: string | null; displayName: string | null; username: string } | null
  size: number
}) {
  const colors = useColors()
  const initial = (profile?.displayName || profile?.username || '?')[0]?.toUpperCase() ?? '?'
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brandSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {profile?.avatarUrl ? (
        <Image source={{ uri: profile.avatarUrl }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text style={{ fontFamily: Fonts.display, fontSize: size * 0.42, color: colors.brandSubtleText }}>
          {initial}
        </Text>
      )}
    </View>
  )
}

function iconForType(type: string) {
  switch (type) {
    case 'started_book':
      return BookOpen
    case 'finished_book':
      return CheckCircle
    case 'highlighted':
      return HighlighterCircle
    case 'reviewed':
      return ChatCircle
    case 'rated':
      return Star
    case 'joined_club':
      return UsersThree
    case 'list_created':
      return ListBullets
    default:
      return BookOpen
  }
}
