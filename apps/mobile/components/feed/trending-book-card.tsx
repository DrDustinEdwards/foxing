import { View, Text, Pressable, Image } from 'react-native'
import { BookOpen } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export function TrendingBookCard({
  id,
  title,
  author,
  coverUrl,
  readerCount,
  onPress,
}: {
  id: string
  title: string
  author: string
  coverUrl: string | null
  readerCount: number
  onPress: (id: string) => void
}) {
  const colors = useColors()
  return (
    <Pressable
      onPress={() => onPress(id)}
      accessibilityRole="button"
      accessibilityLabel={`${title} by ${author}`}
      style={{ width: 120 }}
    >
      <View
        style={{
          width: 120,
          height: 170,
          borderRadius: 6,
          overflow: 'hidden',
          backgroundColor: colors.bgSunken,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
        }}
      >
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={{ width: '100%', height: '100%' }}
            accessibilityRole="image"
            accessibilityLabel={`${title} cover`}
          />
        ) : (
          <BookOpen color={colors.textTertiary} size={20} />
        )}
      </View>
      <Text
        style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textPrimary }}
        numberOfLines={2}
      >
        {title}
      </Text>
      <Text
        style={{ fontFamily: Fonts.ui, fontSize: 10, color: colors.textTertiary, marginTop: 2 }}
      >
        {readerCount} reader{readerCount === 1 ? '' : 's'} this week
      </Text>
    </Pressable>
  )
}
