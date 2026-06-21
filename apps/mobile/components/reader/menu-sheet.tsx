import { useEffect, useState } from 'react'
import { View, Text, Modal, Pressable, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  BookOpen,
  Users,
  Books,
  ImageSquare,
  Share as ShareIcon,
  Sparkle,
  Moon,
  SpeakerHigh,
  MagnifyingGlass,
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

// The primary reading actions (Listen, Go To, Search, This Chapter)
// moved to the top chrome bar. This sheet now surfaces the secondary
// menu OR the chapter-features sub-grid, depending on initialView.
export type MenuInitialView = 'secondary' | 'chapter-features'

interface MenuSheetProps {
  visible: boolean
  bookTitle: string
  bookAuthor: string
  currentChapterTitle?: string
  // Which content to render when the sheet opens. The top bar's Sparkle
  // icon opens it directly to the chapter-features grid; the bottom
  // bar's chevron-up opens it to the secondary menu list.
  initialView?: MenuInitialView
  // Clubs the viewer is in that are reading this book. Appends a "My
  // Clubs Reading This" tile to the secondary list when non-empty.
  clubsReadingThis?: Array<{ club_id: string; name: string }>
  onAction: (action: MenuAction) => void
  // Channel for chapter-feature picks (timeline/quiz/etc).
  onChapterFeature?: (kind: ChapterFeatureKind) => void
  onClose: () => void
}

interface MenuItem {
  key: MenuAction | 'share'
  Icon: Icon
  label: string
}

// Phase 1 overflow: lean utility set. Listen relocated here from the top bar.
const SECONDARY: MenuItem[] = [
  { key: 'listen', Icon: SpeakerHigh, label: 'Listen' },
  { key: 'sleep-timer', Icon: Moon, label: 'Sleep Timer' },
  { key: 'vocabulary', Icon: Books, label: 'Vocabulary' },
  { key: 'quote-card', Icon: ImageSquare, label: 'Quote Card' },
  { key: 'share', Icon: ShareIcon, label: 'Share' },
]

// The Companion hub view (opened from the bottom-bar Companion button) groups
// the AI/reference tools above the chapter-features grid. In Phase 3 the
// Companion becomes the real hub; for now this keeps Story So Far, Characters,
// and Search reachable from one place.
const COMPANION_TOOLS: MenuItem[] = [
  { key: 'story-so-far', Icon: BookOpen, label: 'Story So Far' },
  { key: 'character-map', Icon: Users, label: 'Characters' },
  { key: 'search', Icon: MagnifyingGlass, label: 'Search' },
]

export function MenuSheet({
  visible,
  bookTitle,
  bookAuthor,
  currentChapterTitle,
  initialView = 'secondary',
  clubsReadingThis,
  onAction,
  onChapterFeature,
  onClose,
}: MenuSheetProps) {
  const colors = useColors()
  const [showChapterSub, setShowChapterSub] = useState(
    initialView === 'chapter-features',
  )
  // Sync the sub-view with the initialView prop each time the sheet
  // opens; otherwise re-opening via a different entry point would show
  // the previous view's state.
  useEffect(() => {
    if (visible) {
      setShowChapterSub(initialView === 'chapter-features')
    }
  }, [visible, initialView])

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
    onAction(key)
  }

  function handleClose() {
    setShowChapterSub(false)
    onClose()
  }

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
              <View style={{ paddingBottom: 4 }}>
                {/* Companion tools sit above the chapter-features grid. */}
                <View style={{ paddingHorizontal: 12 }}>
                  <Row items={COMPANION_TOOLS} onSelect={handleSelect} />
                </View>
                <ChapterFeatureGrid
                  currentChapterTitle={currentChapterTitle}
                  onPick={(kind) => {
                    setShowChapterSub(false)
                    onChapterFeature?.(kind)
                    onClose()
                  }}
                  // When the sub-grid was opened directly (initialView ===
                  // 'chapter-features'), the sheet has nothing to go back to;
                  // omit Back so dismissing means closing the sheet.
                  onBack={
                    initialView === 'chapter-features'
                      ? undefined
                      : () => setShowChapterSub(false)
                  }
                />
              </View>
            ) : (
              <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
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
}

function Row({ items, onSelect }: RowProps) {
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
            width: '30.5%',
            alignItems: 'center',
            paddingVertical: 10,
            marginBottom: 4,
            borderRadius: 14,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: colors.brandSubtle,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 6,
            }}
          >
            <item.Icon
              color={colors.brandUi}
              size={20}
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
  // Optional Back affordance. When the grid is opened directly from the
  // top-bar Sparkle icon there's no "previous view" to return to, so the
  // host passes undefined and we just hide the Back label.
  onBack?: () => void
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
        <View style={{ width: 40 }}>
          {onBack ? (
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
          ) : null}
        </View>
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
