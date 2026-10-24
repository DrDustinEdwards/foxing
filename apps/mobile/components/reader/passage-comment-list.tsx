import type * as W from '@foxing/types'
import { ChatCircleDots } from 'phosphor-react-native'
import { ActivityIndicator, Text, View } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { CommentCard } from './passage-comment-card'

/** Top-level comments with their replies underneath. */
export function PassageCommentList({
  loading,
  comments,
  replies,
  revealed,
  onToggleReveal,
  onReply,
}: {
  loading: boolean
  comments: W.ResolvedComment[]
  replies: W.ResolvedComment[]
  revealed: Set<string>
  onToggleReveal: (id: string) => void
  onReply: (comment: W.ResolvedComment) => void
}) {
  const colors = useColors()

  if (loading) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <ActivityIndicator color={colors.brandUi} />
      </View>
    )
  }

  if (comments.length === 0) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center', paddingHorizontal: 24 }}>
        <ChatCircleDots color={colors.textTertiary} size={28} weight="regular" />
        <Text
          style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textTertiary, marginTop: 8, textAlign: 'center' }}
        >
          Nothing here yet. Be the first to comment.
        </Text>
      </View>
    )
  }

  return (
    <>
      {comments.map((c) => (
        <CommentCard
          key={c.id}
          comment={c}
          replies={replies.filter((r) => r.parentId === c.id)}
          revealed={revealed.has(c.id)}
          onToggleReveal={() => onToggleReveal(c.id)}
          onReply={() => onReply(c)}
        />
      ))}
    </>
  )
}
