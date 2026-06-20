import { View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  CaretLeft,
  TextAa,
  BookmarkSimple,
  SpeakerHigh,
  NavigationArrow,
  MagnifyingGlass,
  Sparkle,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import type { MenuAction, MenuInitialView } from '@/components/reader/menu-sheet'

interface ReaderTopBarProps {
  chromeBg: string
  isTablet: boolean
  bookTitle: string
  chapterTitle: string
  isCurrentBookmarked: boolean
  onBack: () => void
  onOpenSettings: () => void
  onBookmarkTap: () => void
  onMenuAction: (action: MenuAction) => void
  onOpenChapterFeatures: () => void
}

export function ReaderTopBar({
  chromeBg,
  isTablet,
  bookTitle,
  chapterTitle,
  isCurrentBookmarked,
  onBack,
  onOpenSettings,
  onBookmarkTap,
  onMenuAction,
  onOpenChapterFeatures,
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
        {/* Row 1: navigation + title + utility icons */}
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
          <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 6 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 14,
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
          </View>
          <Pressable
            onPress={onOpenSettings}
            className="px-2 py-2"
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Reading typography and layout"
          >
            <TextAa color={colors.brandUi} size={22} />
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
        </View>

        {/* Row 2: primary actions. Listen, Go To, Search, This Chapter
            live in chrome so the most-used reading flows are one tap
            away. Secondary items still surface via the bottom-bar
            chevron-up. */}
        <View
          className="flex-row items-center justify-around"
          style={{ marginTop: 4, paddingTop: 4 }}
        >
          <Pressable
            onPress={() => onMenuAction('listen')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Listen"
            style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          >
            <SpeakerHigh color={colors.brandUi} size={22} />
          </Pressable>
          <Pressable
            onPress={() => onMenuAction('go-to')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Go to"
            style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          >
            <NavigationArrow color={colors.brandUi} size={22} />
          </Pressable>
          <Pressable
            onPress={() => onMenuAction('search')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Search"
            style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          >
            <MagnifyingGlass color={colors.brandUi} size={22} />
          </Pressable>
          <Pressable
            onPress={onOpenChapterFeatures}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="This chapter"
            style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          >
            <Sparkle color={colors.brandUi} size={22} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}
