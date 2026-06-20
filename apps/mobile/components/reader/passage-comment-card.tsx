import { View, Text, Pressable, Image } from 'react-native'
import {
  ChatCircleDots,
  Eye,
  EyeSlash,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/feed'
import {
  type PassageComment,
  type PassageCommentReply,
} from '@/lib/passage-comments'

const REACTION_EMOJI = ['👍', '❤️', '🤔', '😂']

export function CommentCard({
  comment,
  revealed,
  onToggleReveal,
  onReact,
  onReply,
}: {
  comment: PassageComment
  revealed: boolean
  onToggleReveal: () => void
  onReact: (emoji: string) => void
  onReply: () => void
}) {
  const colors = useColors()
  const author = comment.author
  const name = author?.display_name ?? author?.username ?? 'Reader'
  const initial = (name || '?')[0]?.toUpperCase() ?? '?'
  const hidden = comment.spoiler_tagged && !revealed

  return (
    <View
      className="flex-row p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: colors.brandSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}
      >
        {author?.avatar_url ? (
          <Image source={{ uri: author.avatar_url }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text style={{ fontFamily: Fonts.display, fontSize: 15, color: colors.brandSubtleText }}>
            {initial}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View className="flex-row items-center" style={{ marginBottom: 2 }}>
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 13,
              color: colors.textPrimary,
              marginRight: 6,
            }}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>
            {relativeTime(comment.created_at)}
          </Text>
        </View>

        {hidden ? (
          <Pressable onPress={onToggleReveal}>
            <View
              style={{
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: colors.bgSelected,
                borderColor: colors.borderBrand,
                borderWidth: 1,
                borderStyle: 'dashed',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <EyeSlash color={colors.brandText} size={14} weight="regular" />
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}>
                Spoiler, tap to reveal
              </Text>
            </View>
          </Pressable>
        ) : (
          <>
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 14,
                color: colors.textPrimary,
                lineHeight: 21,
              }}
            >
              {comment.comment}
            </Text>
            {comment.spoiler_tagged ? (
              <Pressable onPress={onToggleReveal} className="flex-row items-center gap-1 mt-2">
                <Eye color={colors.textTertiary} size={11} />
                <Text style={{ fontFamily: Fonts.ui, fontSize: 10, color: colors.textTertiary }}>
                  Spoiler shown, tap to hide
                </Text>
              </Pressable>
            ) : null}
          </>
        )}

        {/* Reactions */}
        <View className="flex-row items-center mt-3 gap-1 flex-wrap">
          {REACTION_EMOJI.map((emoji) => {
            const group = comment.reactions?.find((g) => g.emoji === emoji)
            const reacted = !!group?.viewerReacted
            return (
              <Pressable
                key={emoji}
                onPress={() => onReact(emoji)}
                className="flex-row items-center gap-1 px-2 py-1 rounded-full border"
                style={{
                  borderColor: reacted ? colors.borderBrand : colors.borderSubtle,
                  backgroundColor: reacted ? colors.bgSelected : 'transparent',
                }}
              >
                <Text style={{ fontSize: 14 }}>{emoji}</Text>
                {group && group.count > 0 ? (
                  <Text
                    style={{
                      fontFamily: Fonts.mono,
                      fontSize: 11,
                      color: reacted ? colors.brandText : colors.textTertiary,
                    }}
                  >
                    {group.count}
                  </Text>
                ) : null}
              </Pressable>
            )
          })}
          <Pressable
            onPress={onReply}
            className="flex-row items-center gap-1 px-2 py-1 rounded-full border"
            style={{ borderColor: colors.borderSubtle, marginLeft: 4 }}
          >
            <ChatCircleDots color={colors.textTertiary} size={12} />
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textTertiary }}>
              Reply
            </Text>
          </Pressable>
        </View>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 ? (
          <View style={{ marginTop: 10, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.borderSubtle }}>
            {comment.replies.map((r) => (
              <ReplyRow key={r.id} reply={r} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

function ReplyRow({
  reply,
}: {
  reply: PassageCommentReply
}) {
  // Replies have no spoiler field in the live schema; render content
  // directly.
  const colors = useColors()
  const name = reply.author?.display_name ?? reply.author?.username ?? 'Reader'
  return (
    <View style={{ marginBottom: 8 }}>
      <View className="flex-row items-center" style={{ marginBottom: 2 }}>
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 12,
            color: colors.textPrimary,
            marginRight: 6,
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text style={{ fontFamily: Fonts.ui, fontSize: 10, color: colors.textTertiary }}>
          {relativeTime(reply.created_at)}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: 13,
          color: colors.textPrimary,
          lineHeight: 19,
        }}
      >
        {reply.content}
      </Text>
    </View>
  )
}
