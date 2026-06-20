import { Dispatch, SetStateAction } from 'react'
import { View, Text, Pressable, Image } from 'react-native'
import { Trash } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/feed'
import type { CommentRow } from './passage-comments-section'

export function PassageCommentCard({
  c,
  userId,
  revealed,
  setRevealed,
  onReply,
  onDelete,
}: {
  c: CommentRow
  userId: string | null
  revealed: Set<string>
  setRevealed: Dispatch<SetStateAction<Set<string>>>
  onReply: (comment: CommentRow) => void
  onDelete: (id: string) => void
}) {
  const colors = useColors()
  const isOwn = c.user_id === userId
  const hidden = c.spoiler_tagged && !revealed.has(c.id) && !isOwn
  return (
    <View
      className="p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: colors.brandSubtle,
          }}
        >
          {c.author?.avatar_url ? (
            <Image
              source={{ uri: c.author.avatar_url }}
              style={{ width: '100%', height: '100%' }}
            />
          ) : null}
        </View>
        <Text
          style={{
            flex: 1,
            fontFamily: Fonts.uiMedium,
            fontSize: 13,
            color: colors.textPrimary,
          }}
          numberOfLines={1}
        >
          {c.author?.display_name ?? 'Reader'}
        </Text>
        <Text
          style={{
            fontFamily: Fonts.mono,
            fontSize: 10,
            color: colors.textTertiary,
          }}
        >
          {relativeTime(c.created_at)}
        </Text>
      </View>
      {hidden ? (
        <Pressable
          onPress={() =>
            setRevealed((prev) => new Set(prev).add(c.id))
          }
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 8,
            backgroundColor: colors.bgSunken,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 12,
              color: colors.brandText,
            }}
          >
            Reveal spoiler
          </Text>
        </Pressable>
      ) : (
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 14,
            color: colors.textPrimary,
            marginTop: 8,
            lineHeight: 21,
          }}
        >
          {c.content}
        </Text>
      )}
      <View
        className="flex-row items-center"
        style={{ gap: 12, marginTop: 8 }}
      >
        <Pressable
          onPress={() => onReply(c)}
          disabled={!userId}
          hitSlop={6}
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 12,
              color: userId ? colors.brandText : colors.textTertiary,
            }}
          >
            Reply
            {c.reply_count > 0 ? ` · ${c.reply_count}` : ''}
          </Text>
        </Pressable>
        {isOwn ? (
          <Pressable
            onPress={() => onDelete(c.id)}
            hitSlop={6}
            style={{ marginLeft: 'auto' }}
          >
            <Trash color={colors.textTertiary} size={14} />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
