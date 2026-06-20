import { View, Text } from 'react-native'
import { ChatCircleDots } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export function PassageCommentsEmpty() {
  const colors = useColors()
  return (
    <View
      className="flex-row items-center p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      style={{ gap: 10 }}
    >
      <ChatCircleDots color={colors.textTertiary} size={20} />
      <Text
        style={{
          flex: 1,
          fontFamily: Fonts.body,
          fontSize: 13,
          color: colors.textTertiary,
        }}
      >
        No notes yet. Add a thought on a passage.
      </Text>
    </View>
  )
}
