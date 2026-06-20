import { View, Text, TextInput, Pressable, ActivityIndicator, Switch } from 'react-native'
import { PaperPlaneRight } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { type PassageComment } from '@/lib/passage-comments'

export function PassageCommentComposer({
  body,
  onChangeBody,
  hasSpoilers,
  onChangeHasSpoilers,
  posting,
  canPost,
  replyTo,
  onCancelReply,
  onSend,
}: {
  body: string
  onChangeBody: (text: string) => void
  hasSpoilers: boolean
  onChangeHasSpoilers: (value: boolean) => void
  posting: boolean
  canPost: boolean
  replyTo: PassageComment | null
  onCancelReply: () => void
  onSend: () => void
}) {
  const colors = useColors()

  return (
    <>
      {replyTo ? (
        <View
          className="flex-row items-center justify-between px-2 py-1 mb-2 rounded-md"
          style={{ backgroundColor: colors.bgSelected }}
        >
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 11,
              color: colors.textSecondary,
              flex: 1,
            }}
            numberOfLines={1}
          >
            Replying to {replyTo.author?.display_name ?? replyTo.author?.username ?? 'reader'}
          </Text>
          <Pressable onPress={onCancelReply} hitSlop={8}>
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandText }}>
              Cancel
            </Text>
          </Pressable>
        </View>
      ) : null}
      <View className="flex-row items-end gap-2">
        <TextInput
          value={body}
          onChangeText={onChangeBody}
          placeholder={
            !canPost
              ? 'Select a club above to post'
              : replyTo
                ? 'Write a reply…'
                : 'Share your take on this passage…'
          }
          placeholderTextColor={colors.textTertiary}
          multiline
          editable={canPost}
          style={{
            flex: 1,
            maxHeight: 140,
            fontFamily: Fonts.body,
            fontSize: 15,
            color: colors.textPrimary,
            backgroundColor: colors.bgBase,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        />
        <Pressable
          onPress={onSend}
          disabled={!body.trim() || posting || !canPost}
          accessibilityLabel="Send"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              body.trim() && canPost ? colors.brandUi : colors.bgDisabled,
            opacity: posting ? 0.7 : 1,
          }}
        >
          {posting ? (
            <ActivityIndicator color={colors.textOnBrand} size="small" />
          ) : (
            <PaperPlaneRight color={colors.textOnBrand} size={16} weight="regular" />
          )}
        </Pressable>
      </View>
      <View className="flex-row items-center mt-2">
        <Switch
          value={hasSpoilers}
          onValueChange={onChangeHasSpoilers}
          trackColor={{ false: colors.bgDisabled, true: colors.toggleOn }}
        />
        <Text
          style={{
            fontFamily: Fonts.ui,
            fontSize: 12,
            color: colors.textSecondary,
            marginLeft: 8,
          }}
        >
          Contains spoilers
        </Text>
      </View>
    </>
  )
}
