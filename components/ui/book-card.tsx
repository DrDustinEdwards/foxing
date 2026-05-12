import { View, Text, Pressable, Image } from 'react-native'
import { useRouter } from 'expo-router'
import type { GutenbergBook } from '@/lib/gutenberg'
import { getAuthorName, getCoverUrl } from '@/lib/gutenberg'

interface BookCardProps {
  book: GutenbergBook
  variant?: 'horizontal' | 'grid'
}

export function BookCard({ book, variant = 'grid' }: BookCardProps) {
  const router = useRouter()
  const cover = getCoverUrl(book)
  const author = getAuthorName(book)
  const widthClass = variant === 'horizontal' ? 'w-32 mr-4' : 'w-[48%] mb-4'

  return (
    <Pressable onPress={() => router.push(`/book/${book.id}`)} className={widthClass}>
      <View
        className="rounded-lg overflow-hidden aspect-[2/3] mb-2"
        style={{ backgroundColor: '#2A1F0F' }}
      >
        {cover ? (
          <Image source={{ uri: cover }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="flex-1 items-center justify-center p-2">
            <Text className="text-center text-xs" style={{ color: '#C4973A' }} numberOfLines={4}>
              {book.title}
            </Text>
          </View>
        )}
      </View>
      <Text className="text-sm font-semibold" style={{ color: '#E8D5B0' }} numberOfLines={2}>
        {book.title}
      </Text>
      <Text className="text-xs" style={{ color: '#8B6914' }} numberOfLines={1}>
        {author}
      </Text>
    </Pressable>
  )
}
