import { useEffect, useState } from 'react'
import { View, Text, Modal, Pressable, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  BookOpen,
  Lightbulb,
  Question,
  Student,
  Users,
  Books,
  ImageSquare,
  Share as ShareIcon,
  Moon,
  SpeakerHigh,
  MagnifyingGlass,
  ChatCircle,
  Lock,
  type Icon,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

/** Companion tools that open as one answer sheet (the server's action names). */
export type CompanionTool =
  | 'character_map'
  | 'book_insight'
  | 'semantic_search'
  | 'chapter_feature'
  | 'deep_dive'
  | 'discussion_starter'

export type MenuAction =
  | 'ask-chat'
  | CompanionTool
  | 'highlights'
  | 'vocabulary'
  | 'quote-card'
  | 'my-clubs'
  | 'listen'
  | 'go-to'
  | 'sleep-timer'

/** What each companion tool's sheet is called. */
export const COMPANION_TOOL_TITLES: Record<CompanionTool, string> = {
  character_map: 'Characters so far',
  book_insight: 'An insight',
  semantic_search: 'Find in the book',
  chapter_feature: 'This chapter',
  deep_dive: 'Go deeper',
  discussion_starter: 'Discussion questions',
}

// The primary reading actions (Listen, Go To, Search) moved to the top chrome bar.
// This sheet surfaces the secondary menu OR the companion hub, depending on initialView.
export type MenuInitialView = 'secondary' | 'companion'

interface MenuSheetProps {
  visible: boolean
  bookTitle: string
  bookAuthor: string
  currentChapterTitle?: string
  // Which content to render when the sheet opens. The top bar's Sparkle
  // icon opens it directly to the companion hub; the bottom
  // bar's chevron-up opens it to the secondary menu list.
  initialView?: MenuInitialView
  // Clubs the viewer is in that are reading this book. Appends a "My
  // Clubs Reading This" tile to the secondary list when non-empty.
  clubsReadingThis?: Array<{ id: string; name: string }>
  onAction: (action: MenuAction) => void
  // Plus gating. When `locked` (free tier), the AI hub entries show a lock
  // badge and route to `onUpgrade` instead of opening the gated sheet.
  locked?: boolean
  onUpgrade?: (feature: string) => void
  onClose: () => void
}

// Companion hub entries that are Plus-gated AI actions. The overflow utility
// items (Listen, Sleep Timer, Vocabulary, Quote Card, Share) are not gated.
const GATED_AI = new Set<MenuAction>(['ask-chat', ...(Object.keys(COMPANION_TOOL_TITLES) as CompanionTool[])])

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

// The Companion hub tools, shown below the prominent Ask/Chat button.
const BOOK_TOOLS: MenuItem[] = [
  { key: 'character_map', Icon: Users, label: 'Characters' },
  { key: 'book_insight', Icon: Lightbulb, label: 'Insight' },
  { key: 'semantic_search', Icon: MagnifyingGlass, label: 'Find' },
]
const CHAPTER_TOOLS: MenuItem[] = [
  { key: 'chapter_feature', Icon: BookOpen, label: 'This chapter' },
  { key: 'deep_dive', Icon: Student, label: 'Go deeper' },
  { key: 'discussion_starter', Icon: Question, label: 'Discuss' },
]

export function MenuSheet({
  visible,
  bookTitle,
  bookAuthor,
  currentChapterTitle,
  initialView = 'secondary',
  clubsReadingThis,
  onAction,
  locked,
  onUpgrade,
  onClose,
}: MenuSheetProps) {
  const colors = useColors()
  const [showCompanion, setShowCompanion] = useState(initialView === 'companion')
  // Sync the sub-view with the initialView prop each time the sheet
  // opens; otherwise re-opening via a different entry point would show
  // the previous view's state.
  useEffect(() => {
    if (visible) {
      setShowCompanion(initialView === 'companion')
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

  function handleSelect(key: MenuItem['key'], label?: string) {
    if (key === 'share') {
      handleShare()
      onClose()
      return
    }
    // Intercept gated AI entries for free users with the upgrade prompt.
    if (locked && GATED_AI.has(key)) {
      onUpgrade?.(label ?? 'This feature')
      return
    }
    onAction(key)
  }

  function handleClose() {
    setShowCompanion(false)
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
            {showCompanion ? (
              <View style={{ paddingBottom: 4 }}>
                <View style={{ paddingHorizontal: 12 }}>
                  <SectionLabel label="This book" />
                  {/* Prominent standalone Ask/Chat entry: opens the companion
                      in general mode (book + chapter context, no seed). */}
                  <Pressable
                    onPress={() => handleSelect('ask-chat', 'Ask')}
                    accessibilityRole="button"
                    accessibilityLabel={locked ? 'Ask a question, Plus feature' : 'Ask a question'}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.brandUi,
                      borderRadius: 14,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      marginBottom: 12,
                    }}
                  >
                    <ChatCircle color={colors.textOnBrand} size={20} weight="fill" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text
                        style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textOnBrand }}
                      >
                        Ask a question
                      </Text>
                      <Text
                        style={{
                          fontFamily: Fonts.ui,
                          fontSize: 11,
                          color: colors.textOnBrand,
                          opacity: 0.85,
                          marginTop: 1,
                        }}
                      >
                        Chat about this book and where you are
                      </Text>
                    </View>
                    {locked ? (
                      <Lock color={colors.textOnBrand} size={16} weight="fill" />
                    ) : null}
                  </Pressable>
                  <Row items={BOOK_TOOLS} onSelect={handleSelect} locked={locked} />
                  <SectionLabel label="This chapter" />
                  <Row items={CHAPTER_TOOLS} onSelect={handleSelect} locked={locked} />
                </View>
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
  onSelect: (key: MenuItem['key'], label: string) => void
  locked?: boolean
}

function Row({ items, onSelect, locked }: RowProps) {
  const colors = useColors()
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
      }}
    >
      {items.map((item) => {
        const isLocked = !!locked && GATED_AI.has(item.key as MenuAction)
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key, item.label)}
            accessibilityRole="button"
            accessibilityLabel={isLocked ? `${item.label}, Plus feature` : item.label}
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
              {isLocked ? <LockBadge colors={colors} /> : null}
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
        )
      })}
    </View>
  )
}

// Small lock badge for gated AI tiles (top-right of the icon).
function LockBadge({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: -3,
        right: -3,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.bgElevated,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Lock color={colors.brandText} size={10} weight="fill" />
    </View>
  )
}

// Group heading inside the Companion hub ("This book" / "This chapter").
function SectionLabel({ label }: { label: string }) {
  const colors = useColors()
  return (
    <Text
      style={{
        fontFamily: Fonts.uiMedium,
        fontSize: 11,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginTop: 4,
        marginBottom: 8,
        paddingHorizontal: 4,
      }}
    >
      {label}
    </Text>
  )
}
