import { useState } from 'react'
import { View, Text, Modal, Pressable, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  BookOpen,
  Users,
  Books,
  MagnifyingGlass,
  ImageSquare,
  Share as ShareIcon,
  Sparkle,
  SpeakerHigh,
  NavigationArrow,
  Moon,
  type Icon,
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
  // Clubs the viewer is in that are reading this book. Bumps the "My
  // Clubs Reading This" item into the secondary row when non-empty.
  clubsReadingThis?: Array<{ club_id: string; name: string }>
  onAction: (action: MenuAction) => void
  // Separate channel for chapter-feature picks (timeline/quiz/etc).
  onChapterFeature?: (kind: ChapterFeatureKind) => void
  onClose: () => void
}

interface MenuItem {
  key: MenuAction | 'share'
  Icon: Icon
  label: string
}

// Kindle-style compact reader menu. Two rows of icon-and-label tiles, no
// scrolling. Primary row is the four actions a reader reaches for most
// often during a session; secondary row is everything else. Long-form
// help text lives in the destination sheets, not here.
const PRIMARY: MenuItem[] = [
  { key: 'listen', Icon: SpeakerHigh, label: 'Listen' },
  { key: 'go-to', Icon: NavigationArrow, label: 'Go To' },
  { key: 'search', Icon: MagnifyingGlass, label: 'Search' },
  { key: 'chapter-features', Icon: Sparkle, label: 'This Chapter' },
]

const SECONDARY: MenuItem[] = [
  { key: 'story-so-far', Icon: BookOpen, label: 'Story So Far' },
  { key: 'character-map', Icon: Users, label: 'Characters' },
  { key: 'sleep-timer', Icon: Moon, label: 'Sleep Timer' },
  { key: 'vocabulary', Icon: Books, label: 'Vocabulary' },
  { key: 'quote-card', Icon: ImageSquare, label: 'Quote Card' },
  { key: 'share', Icon: ShareIcon, label: 'Share' },
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

  function handleSelect(key: MenuItem['key']) {
    if (key === 'share') {
      handleShare()
      onClose()
      return
    }
    if (key === 'chapter-features') {
      setShowChapterSub(true)
      return
    }
    onAction(key)
  }

  function handleClose() {
    setShowChapterSub(false)
    onClose()
  }

  // Inject "My Clubs Reading This" at the end of the secondary row when
  // the viewer belongs to a club reading this book. Keeps the primary
  // row stable at four entries.
  const secondaryWithClubs: MenuItem[] = clubsReadingThis?.length
    ? [
        ...SECONDARY,
        { key: 'my-clubs', Icon: Users, label: 'My Clubs' },
      ]
    : SECONDARY

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable
        className="flex-1 justify-end"
        onPress={handleClose}
        accessibilityLabel="Close menu"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
          accessibilityLabel="Reader menu"
          className="rounded-t-3xl pt-2 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
        >
          <SafeAreaView edges={['bottom']}>
            <View
              style={{
                alignSelf: 'center',
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.borderSubtle,
                marginTop: 6,
                marginBottom: 10,
              }}
            />
            {showChapterSub ? (
              <ChapterFeatureGrid
                currentChapterTitle={currentChapterTitle}
                onPick={(kind) => {
                  setShowChapterSub(false)
                  onChapterFeature?.(kind)
                  onClose()
                }}
                onBack={() => setShowChapterSub(false)}
              />
            ) : (
              <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                <Row items={PRIMARY} onSelect={handleSelect} primary />
                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.borderSubtle,
                    marginVertical: 12,
                  }}
                />
                <Row items={secondaryWithClubs} onSelect={handleSelect} />
              </View>
            )}
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

interface RowProps {
  items: MenuItem[]
  onSelect: (key: MenuItem['key']) => void
  primary?: boolean
}

function Row({ items, onSelect, primary }: RowProps) {
  const colors = useColors()
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
      }}
    >
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => onSelect(item.key)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          style={{
            // Two rows of four-ish items. Width is fractional with a
            // little breathing room so labels don't crowd.
            width: primary ? '24%' : '30.5%',
            alignItems: 'center',
            paddingVertical: 10,
            marginBottom: 4,
            borderRadius: 14,
          }}
        >
          <View
            style={{
              width: primary ? 44 : 38,
              height: primary ? 44 : 38,
              borderRadius: 14,
              backgroundColor: primary ? colors.brandUi : colors.brandSubtle,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 6,
            }}
          >
            <item.Icon
              color={primary ? colors.textOnBrand : colors.brandUi}
              size={primary ? 22 : 18}
              weight="regular"
            />
          </View>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.textSecondary,
            }}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

interface ChapterFeatureGridProps {
  currentChapterTitle?: string
  onPick: (kind: ChapterFeatureKind) => void
  onBack: () => void
}

function ChapterFeatureGrid({
  currentChapterTitle,
  onPick,
  onBack,
}: ChapterFeatureGridProps) {
  const colors = useColors()
  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 6,
          paddingHorizontal: 4,
        }}
      >
        <Pressable onPress={onBack} hitSlop={8}>
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 13,
              color: colors.brandText,
            }}
          >
            Back
          </Text>
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: Fonts.uiMedium,
            fontSize: 12,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          {currentChapterTitle ?? 'This Chapter'}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        {CHAPTER_FEATURES.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => onPick(f.id)}
            accessibilityRole="button"
            accessibilityLabel={f.label}
            style={{
              width: '30.5%',
              alignItems: 'center',
              paddingVertical: 10,
              marginBottom: 4,
              borderRadius: 14,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 14,
                backgroundColor: colors.brandSubtle,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 6,
              }}
            >
              <Sparkle color={colors.brandUi} size={18} />
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 11,
                color: colors.textSecondary,
              }}
            >
              {f.label.replace(/^Chapter /, '')}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
