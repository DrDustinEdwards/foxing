import type * as W from '@foxing/types'
import { View, Text, Pressable, Image } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// The books on the reader's public profile strip.
export function FavoritesStrip({ books, onOpen }: { books: W.ProfileBook[]; onOpen: (slug: string) => void }) {
  const colors = useColors()
  if (books.length === 0) return null
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        Favorites
      </Text>
      <View className="flex-row" style={{ gap: 8 }}>
        {books.slice(0, 5).map((b) => (
          <Pressable
            key={b.bookId}
            onPress={() => onOpen(b.slug)}
            accessibilityRole="link"
            accessibilityLabel={`${b.title} by ${b.author}`}
            style={{
              width: 56,
              height: 84,
              borderRadius: 6,
              overflow: 'hidden',
              backgroundColor: colors.bgSunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {b.coverUrl ? (
              <Image source={{ uri: b.coverUrl }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text
                style={{ fontFamily: Fonts.display, fontSize: 10, color: colors.textTertiary, textAlign: 'center', paddingHorizontal: 4 }}
                numberOfLines={3}
              >
                {b.title}
              </Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  )
}
