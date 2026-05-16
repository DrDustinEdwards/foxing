import { View, Text, Modal, Pressable, ScrollView, Share } from 'react-native'
import {
  BookOpen, Users, BookmarkSimple, Books, MagnifyingGlass, Share as ShareIcon,
  CaretRight, type Icon,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export type MenuAction =
  | 'story-so-far'
  | 'character-map'
  | 'highlights'
  | 'vocabulary'
  | 'search'

interface MenuSheetProps {
  visible: boolean
  bookTitle: string
  bookAuthor: string
  currentChapterTitle?: string
  onAction: (action: MenuAction) => void
  onClose: () => void
}

interface MenuItem {
  key: MenuAction | 'share'
  Icon: Icon
  label: string
  subtitle: string
}

const ITEMS: MenuItem[] = [
  { key: 'story-so-far', Icon: BookOpen, label: 'Story So Far', subtitle: 'Catch up without spoilers' },
  { key: 'character-map', Icon: Users, label: 'Character Map', subtitle: 'Characters you’ve met so far' },
  { key: 'highlights', Icon: BookmarkSimple, label: 'My Highlights', subtitle: 'Your notes and highlights' },
  { key: 'vocabulary', Icon: Books, label: 'Vocabulary', subtitle: 'Words you’ve looked up' },
  { key: 'search', Icon: MagnifyingGlass, label: 'Search', subtitle: 'Find anything in this book' },
  { key: 'share', Icon: ShareIcon, label: 'Share', subtitle: 'Share this book with a friend' },
]

export function MenuSheet({
  visible,
  bookTitle,
  bookAuthor,
  currentChapterTitle,
  onAction,
  onClose,
}: MenuSheetProps) {
  const colors = useColors()

  async function handleShare() {
    try {
      const message = currentChapterTitle
        ? `I'm reading ${bookTitle} by ${bookAuthor} — currently in "${currentChapterTitle}".`
        : `I'm reading ${bookTitle} by ${bookAuthor}.`
      await Share.share({ message })
    } catch (e) {
      console.warn('[menu] share failed', e)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl pt-4 pb-8 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
          style={{ maxHeight: '80%' }}
        >
          <View className="flex-row items-center justify-between px-5 mb-2">
            <Text
              numberOfLines={1}
              style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary, flex: 1 }}
            >
              {bookTitle}
            </Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
            {ITEMS.map((item, idx) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  if (item.key === 'share') {
                    handleShare()
                    onClose()
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
        </Pressable>
      </Pressable>
    </Modal>
  )
}
