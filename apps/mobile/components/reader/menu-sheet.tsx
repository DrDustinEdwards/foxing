import { useState } from 'react'
import { View, Text, Modal, Pressable, ScrollView, Share } from 'react-native'
import {
  BookOpen, Users, BookmarkSimple, Books, MagnifyingGlass, Share as ShareIcon,
  CaretRight, CaretLeft, ImageSquare, Sparkle, SpeakerHigh, NavigationArrow, Moon, type Icon,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { CHAPTER_FEATURES } from './chapter-feature-sheet'
import type { ChapterFeatureKind } from '@/lib/claude'

export type MenuAction =
  | 'story-so-far'
  | 'character-map'
  | 'highlights'
  | 'vocabulary'
  | 'search'
  | 'quote-card'
  | 'my-clubs'
  | 'chapter-features'
  | 'listen'
  | 'go-to'
  | 'sleep-timer'

interface MenuSheetProps {
  visible: boolean
  bookTitle: string
  bookAuthor: string
  currentChapterTitle?: string
  // Clubs the viewer is in that are reading this book, controls the
  // "My Clubs Reading This" menu item visibility.
  clubsReadingThis?: Array<{ club_id: string; name: string }>
  onAction: (action: MenuAction) => void
  // Separate channel for chapter-feature picks, keeps MenuAction a plain
  // string union for the reader's switch statement.
  onChapterFeature?: (kind: ChapterFeatureKind) => void
  onClose: () => void
}

interface MenuItem {
  key: MenuAction | 'share'
  Icon: Icon
  label: string
  subtitle: string
}

const BASE_ITEMS: MenuItem[] = [
  { key: 'story-so-far', Icon: BookOpen, label: 'Story So Far', subtitle: 'Catch up without spoilers' },
  { key: 'character-map', Icon: Users, label: 'Character Map', subtitle: 'Characters you’ve met so far' },
  { key: 'chapter-features', Icon: Sparkle, label: 'This Chapter', subtitle: 'Timeline, themes, quiz, more' },
  { key: 'go-to', Icon: NavigationArrow, label: 'Go To', subtitle: 'Contents, location, bookmarks' },
  { key: 'listen', Icon: SpeakerHigh, label: 'Listen', subtitle: 'Read this chapter aloud' },
  { key: 'sleep-timer', Icon: Moon, label: 'Sleep Timer', subtitle: 'Auto-stop after a set time' },
  { key: 'highlights', Icon: BookmarkSimple, label: 'My Highlights', subtitle: 'Your notes and highlights' },
  { key: 'vocabulary', Icon: Books, label: 'Vocabulary', subtitle: 'Words you’ve looked up' },
  { key: 'search', Icon: MagnifyingGlass, label: 'Search', subtitle: 'Find anything in this book' },
  { key: 'quote-card', Icon: ImageSquare, label: 'Quote Card', subtitle: 'Make a shareable image' },
  { key: 'share', Icon: ShareIcon, label: 'Share', subtitle: 'Share this book with a friend' },
]

export function MenuSheet({
  visible,
  bookTitle,
  bookAuthor,
  currentChapterTitle,
  clubsReadingThis,
  onAction,
  onChapterFeature,
  onClose,
}: MenuSheetProps) {
  const colors = useColors()
  const [showChapterSub, setShowChapterSub] = useState(false)

  const items: MenuItem[] =
    clubsReadingThis && clubsReadingThis.length > 0
      ? [
          {
            key: 'my-clubs',
            Icon: Users,
            label: 'My Clubs Reading This',
            subtitle:
              clubsReadingThis.length === 1
                ? clubsReadingThis[0].name
                : `${clubsReadingThis.length} clubs`,
          },
          ...BASE_ITEMS,
        ]
      : BASE_ITEMS

  async function handleShare() {
    try {
      const message = currentChapterTitle
        ? `I'm reading ${bookTitle} by ${bookAuthor}, currently in "${currentChapterTitle}".`
        : `I'm reading ${bookTitle} by ${bookAuthor}.`
      await Share.share({ message })
    } catch (e) {
      console.warn('[menu] share failed', e)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { setShowChapterSub(false); onClose() }}>
      <Pressable
        className="flex-1 justify-end"
        onPress={() => { setShowChapterSub(false); onClose() }}
        accessibilityLabel="Close menu"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
          accessibilityLabel="Reader menu"
          className="rounded-t-3xl pt-4 pb-8 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
          style={{ maxHeight: '80%' }}
        >
          <View className="flex-row items-center justify-between px-5 mb-2">
            {showChapterSub ? (
              <Pressable
                onPress={() => setShowChapterSub(false)}
                className="flex-row items-center"
                hitSlop={6}
              >
                <CaretLeft color={colors.brandText} size={16} />
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText, marginLeft: 2 }}>
                  Back
                </Text>
              </Pressable>
            ) : (
              <Text
                numberOfLines={1}
                style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary, flex: 1 }}
              >
                {bookTitle}
              </Text>
            )}
            <Pressable
              onPress={() => { setShowChapterSub(false); onClose() }}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
            >
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>Close</Text>
            </Pressable>
          </View>

          {showChapterSub ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
              <Text
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 11,
                  color: colors.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  paddingHorizontal: 20,
                  paddingVertical: 8,
                }}
              >
                {currentChapterTitle || 'Current chapter'}
              </Text>
              {CHAPTER_FEATURES.map((f, idx) => (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    setShowChapterSub(false)
                    onChapterFeature?.(f.id)
                    onClose()
                  }}
                  className="flex-row items-center px-5"
                  style={{
                    minHeight: 60,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: colors.borderSubtle,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      backgroundColor: colors.brandSubtle,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 14,
                    }}
                  >
                    <Sparkle color={colors.brandUi} size={14} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
                      {f.label}
                    </Text>
                    <Text
                      style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}
                    >
                      {f.subtitle}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
            {items.map((item, idx) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  if (item.key === 'share') {
                    handleShare()
                    onClose()
                  } else if (item.key === 'chapter-features') {
                    setShowChapterSub(true)
                  } else {
                    onAction(item.key as MenuAction)
                  }
                }}
                accessibilityRole="button"
                className="flex-row items-center px-5"
                style={{
                  minHeight: 64,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: colors.borderSubtle,
                }}
              >
                <View
                  style={{
                    width: 36, height: 36, borderRadius: 12,
                    backgroundColor: colors.brandSubtle,
                    alignItems: 'center', justifyContent: 'center',
                    marginRight: 14,
                  }}
                >
                  <item.Icon color={colors.brandUi} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}>
                    {item.label}
                  </Text>
                  <Text
                    style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}
                  >
                    {item.subtitle}
                  </Text>
                </View>
                <CaretRight color={colors.textTertiary} size={18} />
              </Pressable>
            ))}
          </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}
