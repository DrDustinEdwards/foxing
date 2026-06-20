import { Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export function ActorNameText({
  name,
  onPress,
}: {
  name: string
  onPress?: () => void
}) {
  const colors = useColors()
  return (
    <Text
      onPress={onPress}
      style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
    >
      {name}
    </Text>
  )
}
