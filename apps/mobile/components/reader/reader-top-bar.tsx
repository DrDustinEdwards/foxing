import { View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CaretLeft, TextAa, BookmarkSimple } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// Phase 1 reading chrome: the top bar is reduced to Back, a tappable
// title/chapter that opens the Go To sheet, Bookmark, and Aa (typography).
// Listen, Search, and the chapter-features (Sparkle) trigger moved to the
// bottom bar (overflow + Companion button).
interface ReaderTopBarProps {
  chromeBg: string
  isTablet: boolean
  bookTitle: string
  chapterTitle: string
  isCurrentBookmarked: boolean
  onBack: () => void
  onOpenGoTo: () => void
  onOpenSettings: () => void
  onBookmarkTap: () => void
}

export function ReaderTopBar({
  chromeBg,
  isTablet,
  bookTitle,
  chapterTitle,
  isCurrentBookmarked,
  onBack,
  onOpenGoTo,
  onOpenSettings,
  onBookmarkTap,
}: ReaderTopBarProps) {
  const colors = useColors()
  return (
    <SafeAreaView
      edges={['top']}
      pointerEvents="box-none"
      className="absolute top-0 left-0 right-0"
    >
      <View
        style={{
          backgroundColor: chromeBg,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
          paddingHorizontal: isTablet ? 24 : 12,
          paddingTop: isTablet ? 10 : 6,
          paddingBottom: isTablet ? 8 : 6,
        }}
      >
        <View className="flex-row items-center">
          <Pressable
            onPress={onBack}
            hitSlop={8}
            className="px-2 py-2"
            accessibilityRole="button"
            accessibilityLabel="Back to library"
          >
            <CaretLeft color={colors.brandUi} size={22} />
          </Pressable>
          {/* Title + chapter is the Go To affordance: tapping it opens the
              table of contents / location sheet. */}
          <Pressable
            onPress={onOpenGoTo}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Table of contents and location"
            style={{ flex: 1, alignItems: 'center', paddingHorizontal: 6 }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 15,
                color: colors.textPrimary,
              }}
            >
              {bookTitle}
            </Text>
            {chapterTitle ? (
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 11,
                  color: colors.textTertiary,
                  marginTop: 1,
                }}
              >
                {chapterTitle}
              </Text>
            ) : null}
          </Pressable>
          <Pressable
            onPress={onBookmarkTap}
            className="px-2 py-2"
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={isCurrentBookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            <BookmarkSimple
              color={colors.brandUi}
              size={22}
              weight={isCurrentBookmarked ? 'fill' : 'regular'}
            />
          </Pressable>
          <Pressable
            onPress={onOpenSettings}
            className="px-2 py-2"
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Reading typography and layout"
          >
            <TextAa color={colors.brandUi} size={22} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}
