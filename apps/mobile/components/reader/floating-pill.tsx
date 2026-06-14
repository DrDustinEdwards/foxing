import { useEffect, useState } from 'react'
import { View, Text, Pressable, useWindowDimensions } from 'react-native'
import {
  MagnifyingGlass,
  ClipboardText,
  Palette,
  ChatCircle,
  UsersThree,
  Highlighter,
  BookmarkSimple,
  X as XIcon,
  type Icon,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { PrivacySelector, type PrivacyTier } from '@/components/privacy-selector'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'

// Seven Foxing highlight colors. Order matches design-system.md and is
// tuned for spectrum visibility, warm tones first, cool last.
export const HIGHLIGHT_COLORS = [
  'amber',
  'auburn',
  'yellow',
  'sage',
  'cobalt',
  'crimson',
  'purple',
] as const

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

export interface PillAnchor {
  x: number // WebView-local px (already in screen coords because WebView fills the View)
  y: number
  width: number
  height: number
}

export type PillMode = 'word' | 'passage'

interface FloatingPillProps {
  visible: boolean
  mode: PillMode
  anchor: PillAnchor | null
  onDismiss: () => void
  // Word actions
  onLookup?: () => void
  // Passage actions
  onAnalyze?: () => void
  onDiscuss?: () => void
  // Inline club passage-comment action, only renders in passage mode and
  // only when the viewer belongs to a club currently reading this book.
  showClub?: boolean
  onClub?: () => void
  // Shared, both modes show Highlight. Privacy is selected inline after
  // color pick (Section 3 of task.md). Callers translate to is_public.
  onHighlight: (color: HighlightColor, privacy: PrivacyTier) => void
}

const PILL_HEIGHT = 44
const PILL_VERTICAL_GAP = 10 // gap between word and pill
const PILL_HORIZONTAL_PAD = 8

export function FloatingPill({
  visible,
  mode,
  anchor,
  onDismiss,
  onLookup,
  onAnalyze,
  onDiscuss,
  showClub,
  onClub,
  onHighlight,
}: FloatingPillProps) {
  const colors = useColors()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const [showColors, setShowColors] = useState(false)
  // After a color is picked, the pill transitions to the privacy step so
  // the user can choose where the highlight is visible before it's written.
  const [pendingColor, setPendingColor] = useState<HighlightColor | null>(null)
  const [privacyDraft, setPrivacyDraft] = useState<PrivacyTier>('public')
  // Long-press → all-options bottom sheet (Section 4 of task.md).
  const [allOptionsOpen, setAllOptionsOpen] = useState(false)

  // Reset color picker when the pill closes or the anchor changes
  // (new word tap shouldn't inherit prior color-mode state).
  useEffect(() => {
    if (!visible) {
      setShowColors(false)
      setPendingColor(null)
      setPrivacyDraft('public')
      setAllOptionsOpen(false)
    }
  }, [visible, anchor?.x, anchor?.y])

  if (!visible || !anchor) return null

  // Pick a swatch background per color from the highlight token map. Using
  // the foreground tier (-t) for visibility since the bg-tier is meant
  // to sit BEHIND text, not stand alone as a swatch.
  const swatchColor = (c: HighlightColor): string => {
    switch (c) {
      case 'amber': return colors.hlAmberT
      case 'auburn': return colors.hlAuburnT
      case 'yellow': return colors.hlYellowT
      case 'sage': return colors.hlSageT
      case 'cobalt': return colors.hlCobaltT
      case 'crimson': return colors.hlCrimsonT
      case 'purple': return colors.hlPurpleT
    }
  }

  // Pill width is content-driven; we measure-on-render via approximate
  // content widths. Position anchor above the word with a small gap; if
  // the result would be off the top of the screen, place it BELOW instead.
  const passagePillWidth = mode === 'passage' && showClub ? 360 : 280
  const approxPillWidth = showColors ? 280 : (mode === 'word' ? 200 : passagePillWidth)
  const idealLeft = anchor.x + anchor.width / 2 - approxPillWidth / 2
  const left = Math.max(
    PILL_HORIZONTAL_PAD,
    Math.min(idealLeft, screenWidth - approxPillWidth - PILL_HORIZONTAL_PAD),
  )
  // Prefer above. If above clips behind the top chrome, drop below, but
  // only if below stays clear of the bottom safe-area / chrome (100px slack).
  // If both placements overflow, clamp above to a minimum top.
  const aboveTop = anchor.y - PILL_HEIGHT - PILL_VERTICAL_GAP
  const belowTop = anchor.y + anchor.height + PILL_VERTICAL_GAP
  const BOTTOM_LIMIT = screenHeight - 100
  let top: number
  if (aboveTop >= 60) {
    top = aboveTop
  } else if (belowTop + PILL_HEIGHT <= BOTTOM_LIMIT) {
    top = belowTop
  } else {
    top = Math.max(60, aboveTop)
  }

  const pillStyle = {
    position: 'absolute' as const,
    left,
    top,
    height: PILL_HEIGHT,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    shadowColor: colors.shadowMd,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  }

  const labelStyle = {
    fontFamily: Fonts.uiMedium,
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
  }

  const ICON_SIZE = 18
  const iconColor = colors.brandText

  // Color-picker mode: swatch row inside the pill. After a color is picked
  // (pendingColor !== null) the pill swaps to a privacy selector + Save
  // button, Section 3 of task.md.
  if (showColors) {
    if (pendingColor === null) {
      return (
        <View
          style={pillStyle}
          accessible
          accessibilityViewIsModal
          accessibilityLabel="Choose highlight color"
        >
          {HIGHLIGHT_COLORS.map((c, idx) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Highlight ${c}`}
              // First swatch gets focus so a screen-reader user lands on a
              // selectable color immediately when the picker opens.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...(idx === 0 ? ({ accessibilityAutoFocus: true } as any) : {})}
              onPress={() => setPendingColor(c)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: swatchColor(c),
                marginHorizontal: 3,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
              }}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel highlight"
            onPress={() => setShowColors(false)}
            style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          >
            <XIcon color={iconColor} size={ICON_SIZE} />
          </Pressable>
        </View>
      )
    }
    // Privacy step, color chosen, now pick who can see it. Wider, taller
    // pill so the three privacy pills fit comfortably.
    const privacyPillStyle = {
      ...pillStyle,
      left: Math.max(PILL_HORIZONTAL_PAD, anchor.x + anchor.width / 2 - 160),
      width: 320,
      height: undefined,
      flexDirection: 'column' as const,
      alignItems: 'stretch' as const,
      paddingVertical: 10,
      paddingHorizontal: 12,
    }
    return (
      <View
        style={privacyPillStyle}
        accessible
        accessibilityViewIsModal
        accessibilityLabel="Choose highlight privacy"
      >
        <View className="flex-row items-center" style={{ marginBottom: 8, gap: 8 }}>
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: swatchColor(pendingColor),
              borderWidth: 1,
              borderColor: colors.borderSubtle,
            }}
          />
          <Text
            style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textSecondary, flex: 1 }}
          >
            Who can see this?
          </Text>
        </View>
        <PrivacySelector value={privacyDraft} onChange={setPrivacyDraft} dense />
        <View className="flex-row items-center justify-end" style={{ marginTop: 10, gap: 10 }}>
          <Pressable
            onPress={() => setPendingColor(null)}
            accessibilityRole="button"
            accessibilityLabel="Back to color picker"
            hitSlop={4}
          >
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textTertiary }}
            >
              Back
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              onHighlight(pendingColor, privacyDraft)
              onDismiss()
            }}
            accessibilityRole="button"
            accessibilityLabel="Save highlight"
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: colors.brandUi }}
          >
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textOnBrand }}
            >
              Save
            </Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <>
    <Pressable
      onLongPress={() => setAllOptionsOpen(true)}
      delayLongPress={350}
      style={pillStyle}
      accessible
      accessibilityViewIsModal
      accessibilityLabel={mode === 'word' ? 'Word actions' : 'Passage actions'}
      accessibilityHint="Long press for all options"
    >
      {mode === 'word' ? (
        <>
          <PillAction
            primary
            Icon={MagnifyingGlass}
            label="Look up"
            a11yLabel="Look up word"
            autoFocus
            onPress={() => onLookup?.()}
          />
          <PillDivider colors={colors} />
          <PillAction
            Icon={Palette}
            label="Highlight"
            a11yLabel="Highlight"
            onPress={() => setShowColors(true)}
          />
        </>
      ) : showClub ? (
        // Club-first passage layout per task.md Section G, when the viewer
        // belongs to a club reading this book, the most useful action is
        // jumping to club discussion of this passage.
        <>
          <PillAction
            primary
            Icon={UsersThree}
            label="Club"
            a11yLabel="Club discussion on passage"
            autoFocus
            onPress={() => onClub?.()}
          />
          <PillDivider colors={colors} />
          <PillAction
            Icon={Palette}
            label="Highlight"
            a11yLabel="Highlight"
            onPress={() => setShowColors(true)}
          />
          <PillDivider colors={colors} />
          <PillAction
            Icon={ClipboardText}
            label="Analyze"
            a11yLabel="Analyze passage"
            onPress={() => onAnalyze?.()}
          />
        </>
      ) : (
        // Solo passage layout, highlight is the most common action.
        <>
          <PillAction
            primary
            Icon={Palette}
            label="Highlight"
            a11yLabel="Highlight"
            autoFocus
            onPress={() => setShowColors(true)}
          />
          <PillDivider colors={colors} />
          <PillAction
            Icon={ClipboardText}
            label="Analyze"
            a11yLabel="Analyze passage"
            onPress={() => onAnalyze?.()}
          />
          <PillDivider colors={colors} />
          <PillAction
            Icon={ChatCircle}
            label="Discuss"
            a11yLabel="Discuss passage"
            onPress={() => onDiscuss?.()}
          />
        </>
      )}

      <View style={{ width: 1, height: 22, backgroundColor: colors.borderSubtle, marginHorizontal: 4 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss pill"
        onPress={onDismiss}
        style={{ paddingHorizontal: 10, paddingVertical: 8 }}
      >
        <XIcon color={iconColor} size={ICON_SIZE} />
      </Pressable>
    </Pressable>

    <AllOptionsSheet
      visible={allOptionsOpen}
      mode={mode}
      showClub={!!showClub}
      onClose={() => setAllOptionsOpen(false)}
      onLookup={onLookup}
      onAnalyze={onAnalyze}
      onDiscuss={onDiscuss}
      onClub={onClub}
      onHighlight={() => {
        setAllOptionsOpen(false)
        setShowColors(true)
      }}
      onSavePassage={() => {
        setAllOptionsOpen(false)
        onHighlight('amber', 'public')
        onDismiss()
      }}
      onDismissAll={() => {
        setAllOptionsOpen(false)
        onDismiss()
      }}
    />
    </>
  )
}

// All-options bottom sheet shown on long-press of the pill (Section 4).
// Each action calls the existing handler the floating pill already wires.
function AllOptionsSheet({
  visible,
  mode,
  showClub,
  onClose,
  onLookup,
  onAnalyze,
  onDiscuss,
  onClub,
  onHighlight,
  onSavePassage,
  onDismissAll,
}: {
  visible: boolean
  mode: PillMode
  showClub: boolean
  onClose: () => void
  onLookup?: () => void
  onAnalyze?: () => void
  onDiscuss?: () => void
  onClub?: () => void
  onHighlight: () => void
  onSavePassage: () => void
  onDismissAll: () => void
}) {
  const colors = useColors()
  const items: Array<{
    key: string
    label: string
    Icon: Icon
    onPress: () => void
    destructive?: boolean
  }> = []
  items.push({ key: 'highlight', label: 'Highlight', Icon: Highlighter, onPress: onHighlight })
  if (mode === 'word') {
    items.push({ key: 'lookup', label: 'Look up word', Icon: MagnifyingGlass, onPress: () => onLookup?.() })
  } else {
    items.push({ key: 'analyze', label: 'Analyze', Icon: MagnifyingGlass, onPress: () => onAnalyze?.() })
    items.push({ key: 'discuss', label: 'Discuss with AI', Icon: ChatCircle, onPress: () => onDiscuss?.() })
    if (showClub) {
      items.push({ key: 'club', label: 'Club comment', Icon: UsersThree, onPress: () => onClub?.() })
    }
    items.push({ key: 'save', label: 'Save Passage', Icon: BookmarkSimple, onPress: onSavePassage })
  }
  items.push({ key: 'dismiss', label: 'Dismiss', Icon: XIcon, onPress: onDismissAll, destructive: true })

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      scroll={false}
      header={
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            paddingHorizontal: 20,
            marginBottom: 8,
          }}
        >
          Actions
        </Text>
      }
    >
          {items.map((item, i) => (
            <Pressable
              key={item.key}
              onPress={() => {
                onClose()
                item.onPress()
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              className="flex-row items-center px-5"
              style={{
                minHeight: 56,
                borderTopWidth: i === 0 ? 0 : 1,
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
                  marginRight: 12,
                }}
              >
                <item.Icon
                  color={item.destructive ? colors.error : colors.brandUi}
                  size={16}
                />
              </View>
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 15,
                  color: item.destructive ? colors.error : colors.textPrimary,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
    </SheetScaffold>
  )
}

// One action chip inside the pill. Primary chips get a brand-subtle bg so
// the eye lands on them first. autoFocus is iOS-only; safe to pass as a
// no-op elsewhere via the type cast.
function PillAction({
  Icon,
  label,
  a11yLabel,
  onPress,
  primary,
  autoFocus,
}: {
  Icon: React.ComponentType<{ color: string; size: number; weight?: 'regular' | 'bold' | 'fill' }>
  label: string
  a11yLabel: string
  onPress: () => void
  primary?: boolean
  autoFocus?: boolean
}) {
  const colors = useColors()
  const ICON_SIZE = 18
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...(autoFocus ? ({ accessibilityAutoFocus: true } as any) : {})}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: primary ? 12 : 10,
        paddingVertical: 8,
        marginVertical: 2,
        marginHorizontal: primary ? 2 : 0,
        borderRadius: 999,
        backgroundColor: primary ? colors.brandSubtle : 'transparent',
      }}
    >
      <Icon color={primary ? colors.brandSubtleText : colors.brandText} size={ICON_SIZE} />
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 13,
          color: primary ? colors.brandSubtleText : colors.textSecondary,
          marginLeft: 6,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function PillDivider({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View
      style={{ width: 1, height: 22, backgroundColor: colors.borderSubtle, marginHorizontal: 4 }}
    />
  )
}
