import type { ClubPost } from '@/lib/clubs'
import { useColors } from '@/constants/colors'
import { Image, Pressable, Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/feed'
import { ChatCircleDots, Eye, EyeSlash } from 'phosphor-react-native'

const REACTION_EMOJI = ['👍', '❤️', '🤔', '😂']

export function PostCard({
  post,
  nested,
  revealed,
  viewerId,
  onToggleReveal,
  onReact,
  onReply,
  onOpenAuthor,
  onLongPress,
}: {
  post: ClubPost
  nested?: boolean
  revealed: boolean
  viewerId: string | null
  onToggleReveal: () => void
  onReact: (emoji: string) => void
  onReply?: () => void
  onOpenAuthor: (id: string) => void
  onLongPress?: () => void
}) {
  const colors = useColors()
  const name = post.author?.display_name ?? post.author?.username ?? 'Reader'
  const initial = (name || '?')[0]?.toUpperCase() ?? '?'
  const hidden = post.has_spoiler && !revealed

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={400}
      className="flex-row p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      style={{ opacity: nested ? 0.98 : 1 }}
    >
      <Pressable onPress={() => onOpenAuthor(post.author_id)} hitSlop={4}>
        <View
          style={{
            width: nested ? 32 : 36,
            height: nested ? 32 : 36,
            borderRadius: 18,
            overflow: 'hidden',
            backgroundColor: colors.brandSubtle,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          {post.author?.avatar_url ? (
            <Image
              source={{ uri: post.author.avatar_url }}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <Text
              style={{
                fontFamily: Fonts.display,
                fontSize: nested ? 14 : 15,
                color: colors.brandSubtleText,
              }}
            >
              {initial}
            </Text>
          )}
        </View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <View className="flex-row items-center" style={{ marginBottom: 2 }}>
          <Text
            onPress={() => onOpenAuthor(post.author_id)}
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
            {relativeTime(post.created_at)}
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
              {post.content}
            </Text>
            {post.has_spoiler ? (
              <Pressable
                onPress={onToggleReveal}
                className="flex-row items-center gap-1 mt-2"
              >
                <Eye color={colors.textTertiary} size={11} />
                <Text style={{ fontFamily: Fonts.ui, fontSize: 10, color: colors.textTertiary }}>
                  Spoiler shown, tap to hide
                </Text>
              </Pressable>
            ) : null}
          </>
        )}

        {/* Reaction row */}
        <View className="flex-row items-center mt-3 gap-1 flex-wrap">
          {REACTION_EMOJI.map((emoji) => {
            const group = post.reactions?.find((g) => g.emoji === emoji)
            const reacted = !!group?.viewerReacted
            return (
              <Pressable
                key={emoji}
                onPress={() => onReact(emoji)}
                disabled={!viewerId}
                className="flex-row items-center gap-1 px-2 py-1 rounded-full border"
                style={{
                  borderColor: reacted ? colors.borderBrand : colors.borderSubtle,
                  backgroundColor: reacted ? colors.bgSelected : 'transparent',
                  opacity: viewerId ? 1 : 0.5,
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
          {onReply && viewerId && !nested ? (
            <Pressable
              onPress={onReply}
              className="flex-row items-center gap-1 px-2 py-1 rounded-full border"
              style={{ borderColor: colors.borderSubtle, marginLeft: 4 }}
            >
              <ChatCircleDots color={colors.textTertiary} size={12} />
              <Text
                style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textTertiary }}
              >
                Reply
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}
