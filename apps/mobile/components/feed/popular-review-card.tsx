import { View, Text, Pressable, Image } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export function PopularReviewCard({
  rating,
  review,
  user,
  book,
  onPressBook,
  onPressUser,
}: {
  rating: number | null
  review: string
  user: {
    id: string
    display_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
  book: { id: string; title: string; cover_url: string | null } | null
  onPressBook: (id: string) => void
  onPressUser: (id: string) => void
}) {
  const colors = useColors()
  const name = user?.display_name ?? user?.username ?? 'Reader'
  return (
    <View
      className="p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <View className="flex-row items-center" style={{ marginBottom: 6 }}>
        {user ? (
          <Pressable
            onPress={() => onPressUser(user.id)}
            accessibilityRole="button"
            accessibilityLabel={`Open profile for ${name}`}
            className="flex-row items-center"
            style={{ flex: 1, gap: 8 }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: colors.brandSubtle,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {user.avatar_url ? (
                <Image
                  source={{ uri: user.avatar_url }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 11,
                    color: colors.brandSubtleText,
                  }}
                >
                  {name[0]?.toUpperCase() ?? '?'}
                </Text>
              )}
            </View>
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}
              numberOfLines={1}
            >
              {name}
            </Text>
          </Pressable>
        ) : null}
        {rating ? (
          <Text
            style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.brandSecondary }}
          >
            {'★'.repeat(rating)}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 18,
        }}
        numberOfLines={3}
      >
        {review}
      </Text>
      {book ? (
        <Pressable
          onPress={() => onPressBook(book.id)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${book.title}`}
          style={{ marginTop: 6 }}
        >
          <Text
            style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandText }}
            numberOfLines={1}
          >
            on {book.title}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
