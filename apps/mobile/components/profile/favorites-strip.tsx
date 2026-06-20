import { View, Text, Pressable, Image, Alert } from 'react-native'
import { Plus } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

type FavoriteSlot = {
  position: number
  book: { id: string; title: string; author: string; cover_url: string | null } | null
}

export function FavoritesStrip({
  favorites,
  onPickSlot,
  onRemove,
}: {
  favorites: FavoriteSlot[]
  onPickSlot: (position: number) => void
  onRemove: (position: number) => void
}) {
  const colors = useColors()
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
        My 5 books
      </Text>
      <View className="flex-row" style={{ gap: 8 }}>
        {favorites.map((slot) => {
          const filled = !!slot.book
          return (
            <Pressable
              key={slot.position}
              onPress={() => {
                if (filled) {
                  Alert.alert(slot.book!.title, undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Replace', onPress: () => onPickSlot(slot.position) },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => onRemove(slot.position),
                    },
                  ])
                } else {
                  onPickSlot(slot.position)
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={
                filled
                  ? `Favorite ${slot.position}: ${slot.book!.title}`
                  : `Empty favorite slot ${slot.position}`
              }
              style={{
                width: 56,
                height: 84,
                borderRadius: 6,
                overflow: 'hidden',
                borderWidth: filled ? 0 : 1.5,
                borderColor: colors.borderBrand,
                borderStyle: filled ? 'solid' : 'dashed',
                backgroundColor: filled ? colors.bgSunken : colors.brandSubtle,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {filled && slot.book?.cover_url ? (
                <Image
                  source={{ uri: slot.book.cover_url }}
                  style={{ width: '100%', height: '100%' }}
                  accessibilityRole="image"
                  accessibilityLabel={`${slot.book.title} cover`}
                />
              ) : filled ? (
                <Text
                  style={{
                    fontFamily: Fonts.display,
                    fontSize: 10,
                    color: colors.textTertiary,
                    textAlign: 'center',
                    paddingHorizontal: 4,
                  }}
                  numberOfLines={3}
                >
                  {slot.book?.title}
                </Text>
              ) : (
                <Plus color={colors.brandUi} size={18} weight="bold" />
              )}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
