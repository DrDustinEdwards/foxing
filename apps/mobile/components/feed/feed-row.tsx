import { type ActivityEvent, type ActivityType, relativeTime } from '@/lib/feed'
import { useColors } from '@/constants/colors'
import { Image, Pressable, Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'
import { ActorNameText } from '@/components/feed/actor-name-text'
import { Bookmark, BookOpen, ChatCircle, CheckCircle, HighlighterCircle, MagnifyingGlass, Trophy, UserPlus } from 'phosphor-react-native'

export function makeEventFromRealtime(
  table: 'highlights' | 'user_books' | 'follows',
  row: Record<string, unknown>,
): ActivityEvent | null {
  if (table === 'highlights') {
    const id = String(row.id ?? '')
    const userId = String(row.user_id ?? '')
    if (!id || !userId) return null
    return {
      key: `highlight:${id}`,
      type: 'highlighted',
      actorId: userId,
      bookId: (row.book_id as string | null) ?? null,
      text: (row.text as string | undefined) ?? undefined,
      color: (row.color as string | null) ?? null,
      createdAt: String(row.created_at ?? new Date().toISOString()),
    }
  }
  if (table === 'follows') {
    const follower = String(row.follower_id ?? '')
    const following = String(row.following_id ?? '')
    if (!follower || !following) return null
    return {
      key: `follow:${follower}:${following}`,
      type: 'followed_user',
      actorId: follower,
      targetUserId: following,
      createdAt: String(row.created_at ?? new Date().toISOString()),
    }
  }
  // user_books, a single insert can represent any of three actions.
  // INSERTs cover added_to_library and started/finished from-scratch. UPDATEs
  // would fire for status changes, but we don't subscribe to UPDATEs in v1.
  const id = String(row.id ?? '')
  const userId = String(row.user_id ?? '')
  if (!id || !userId) return null
  const status = (row.status as string) ?? ''
  const startedAt = row.started_at as string | null
  const finishedAt = row.finished_at as string | null
  const createdAt = String(row.created_at ?? new Date().toISOString())
  let type: ActivityType
  let ts = createdAt
  if (status === 'finished' && finishedAt) {
    type = 'finished_book'
    ts = finishedAt
  } else if (startedAt) {
    type = 'started_book'
    ts = startedAt
  } else {
    type = 'added_to_library'
  }
  const keyPrefix = type === 'finished_book' ? 'finished' : type === 'started_book' ? 'started' : 'added'
  return {
    key: `${keyPrefix}:${id}`,
    type,
    actorId: userId,
    bookId: (row.book_id as string | null) ?? null,
    createdAt: ts,
  }
}

export function FeedRow({
  event,
  onPressActor,
  onPressBook,
  onPressTarget,
}: {
  event: ActivityEvent
  onPressActor?: () => void
  onPressBook?: () => void
  onPressTarget?: () => void
}) {
  const colors = useColors()
  const actorName = event.actor?.display_name ?? event.actor?.username ?? 'Reader'
  const Icon = iconForType(event.type)

  return (
    <View
      className="flex-row p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <Pressable onPress={onPressActor} hitSlop={4}>
        <Avatar actor={event.actor ?? null} size={40} />
      </Pressable>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View className="flex-row items-center" style={{ marginBottom: 2 }}>
          <Icon color={colors.brandText} size={14} weight="regular" />
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 11,
              color: colors.textTertiary,
              marginLeft: 6,
            }}
          >
            {relativeTime(event.createdAt)}
          </Text>
        </View>
        <ActionLine
          event={event}
          actorName={actorName}
          onPressActor={onPressActor}
          onPressBook={onPressBook}
          onPressTarget={onPressTarget}
        />
        {event.type === 'highlighted' && event.text ? (
          <View
            style={{
              marginTop: 8,
              padding: 10,
              borderLeftWidth: 3,
              borderLeftColor: highlightAccentFor(event.color, colors.brandUi),
              backgroundColor: colors.bgSunken,
              borderRadius: 6,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textPrimary,
                lineHeight: 19,
                fontStyle: 'italic',
              }}
              numberOfLines={3}
            >
              “{event.text}”
            </Text>
          </View>
        ) : null}
        {event.type === 'chapter_reaction' && event.text ? (
          <View
            style={{
              marginTop: 8,
              padding: 10,
              borderLeftWidth: 3,
              borderLeftColor: colors.brandUi,
              backgroundColor: colors.bgSunken,
              borderRadius: 6,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textPrimary,
                lineHeight: 19,
                fontStyle: 'italic',
              }}
              numberOfLines={3}
            >
              "{event.text}"
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

function ActionLine({
  event,
  actorName,
  onPressActor,
  onPressBook,
  onPressTarget,
}: {
  event: ActivityEvent
  actorName: string
  onPressActor?: () => void
  onPressBook?: () => void
  onPressTarget?: () => void
}) {
  const colors = useColors()
  const nameText = <ActorNameText name={actorName} onPress={onPressActor} />
  const bookText = event.book ? (
    <Text
      onPress={onPressBook}
      style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.brandText }}
      numberOfLines={1}
    >
      {event.book.title}
    </Text>
  ) : (
    <Text style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textTertiary }}>
      a book
    </Text>
  )

  const base = { fontFamily: Fonts.ui, fontSize: 14, color: colors.textSecondary } as const

  switch (event.type) {
    case 'started_book':
      return <Text style={base}>{nameText} started reading {bookText}</Text>
    case 'finished_book':
      return <Text style={base}>{nameText} finished {bookText}</Text>
    case 'added_to_library':
      return <Text style={base}>{nameText} added {bookText} to their library</Text>
    case 'highlighted':
      return <Text style={base}>{nameText} highlighted from {bookText}</Text>
    case 'looked_up_word':
      return (
        <Text style={base}>
          {nameText} looked up{' '}
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary }}>
            {event.word ?? 'a word'}
          </Text>{' '}
          in {bookText}
        </Text>
      )
    case 'earned_badge':
      return (
        <Text style={base}>
          {nameText} earned the{' '}
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary }}>
            {event.badge?.name ?? 'a'}
          </Text>{' '}
          badge
        </Text>
      )
    case 'followed_user': {
      const target = event.targetUser?.display_name ?? event.targetUser?.username ?? 'a reader'
      return (
        <Text style={base}>
          {nameText} followed{' '}
          <Text
            onPress={onPressTarget}
            style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}
          >
            {target}
          </Text>
        </Text>
      )
    }
    case 'chapter_reaction':
      return (
        <Text style={base}>
          {nameText} reacted{' '}
          <Text style={{ fontSize: 16 }}>{event.reactionEmoji ?? ''}</Text>
          {' to '}
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary }}>
            {event.reactionChapter || 'a chapter'}
          </Text>
          {event.book ? <Text>{' of '}{bookText}</Text> : null}
        </Text>
      )
  }
}

export function Avatar({ actor, size }: { actor: { avatar_url: string | null; display_name: string | null; username: string | null } | null; size: number }) {
  const colors = useColors()
  const initial =
    (actor?.display_name || actor?.username || '?')[0]?.toUpperCase() ?? '?'
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
      {actor?.avatar_url ? (
        <Image source={{ uri: actor.avatar_url }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text
          style={{
            fontFamily: Fonts.display,
            fontSize: size * 0.42,
            color: colors.brandSubtleText,
          }}
        >
          {initial}
        </Text>
      )}
    </View>
  )
}

// Map type → phosphor icon component.
function iconForType(type: ActivityType) {
  switch (type) {
    case 'started_book':
      return BookOpen
    case 'finished_book':
      return CheckCircle
    case 'added_to_library':
      return Bookmark
    case 'highlighted':
      return HighlighterCircle
    case 'looked_up_word':
      return MagnifyingGlass
    case 'earned_badge':
      return Trophy
    case 'followed_user':
      return UserPlus
    case 'chapter_reaction':
      return ChatCircle
  }
}

// Map a highlight color slug → an accent hex (for the left border of the
// quoted text block). Falls back to brand amber for unknown / unset.
function highlightAccentFor(color: string | null | undefined, fallback: string): string {
  switch (color) {
    case 'amber': return '#F5C060'
    case 'auburn': return '#F0A070'
    case 'yellow': return '#F4E47B'
    case 'sage': return '#72CA9A'
    case 'cobalt': return '#70A6DB'
    case 'crimson': return '#E46872'
    case 'purple': return '#B58DE2'
    default: return fallback
  }
}
