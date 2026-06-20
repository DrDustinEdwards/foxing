import { View, Text, ActivityIndicator } from 'react-native'
import { ChatCircleDots } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { type PassageComment } from '@/lib/passage-comments'
import { CommentCard } from './passage-comment-card'

export function PassageCommentList({
  loading,
  comments,
  revealed,
  onToggleReveal,
  onReact,
  onReply,
}: {
  loading: boolean
  comments: PassageComment[]
  revealed: Set<string>
  onToggleReveal: (id: string) => void
  onReact: (id: string, emoji: string) => void
  onReply: (comment: PassageComment) => void
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
          style={{
            fontFamily: Fonts.body,
            fontSize: 13,
            color: colors.textTertiary,
            marginTop: 8,
            textAlign: 'center',
          }}
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
          revealed={revealed.has(c.id)}
          onToggleReveal={() => onToggleReveal(c.id)}
          onReact={(emoji) => onReact(c.id, emoji)}
          onReply={() => onReply(c)}
        />
      ))}
    </>
  )
}
