import type * as W from '@foxing/types'
import { useColors } from '@/constants/colors'
import { Image, Pressable, Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/relative-time'
import { ChatCircleDots, Eye, EyeSlash } from 'phosphor-react-native'

export function PostCard({
  post,
  nested,
  revealed,
  canReply,
  onToggleReveal,
  onReply,
  onOpenAuthor,
  onLongPress,
}: {
  post: W.ClubPostItem
  nested?: boolean
  revealed: boolean
  canReply: boolean
  onToggleReveal: () => void
  onReply?: () => void
  onOpenAuthor: (username: string) => void
  onLongPress?: () => void
}) {
  const colors = useColors()
  const name = post.author?.displayName ?? post.author?.username ?? 'Reader'
  const initial = (name || '?')[0]?.toUpperCase() ?? '?'
  const hidden = post.hasSpoiler && !revealed

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={400}
      className="flex-row p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      style={{ opacity: nested ? 0.98 : 1 }}
    >
      <Pressable onPress={() => post.author && onOpenAuthor(post.author.username)} hitSlop={4}>
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
          {post.author?.avatarUrl ? (
            <Image
              source={{ uri: post.author.avatarUrl }}
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
            onPress={() => post.author && onOpenAuthor(post.author.username)}
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
            {relativeTime(post.createdAt)}
            {post.isEdited ? ' · edited' : ''}
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
            {post.hasSpoiler ? (
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

        <View className="flex-row items-center mt-3 gap-1 flex-wrap">
          {onReply && canReply && !nested ? (
            <Pressable
              onPress={onReply}
              className="flex-row items-center gap-1 px-2 py-1 rounded-full border"
              style={{ borderColor: colors.borderSubtle }}
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
