import { useEffect, useState } from 'react'
import { View, Text, Pressable, useWindowDimensions } from 'react-native'
import {
  MagnifyingGlass,
  ClipboardText,
  Palette,
  ChatCircle,
  UsersThree,
  Translate,
  X as XIcon,
  type Icon,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { PrivacySelector, type PrivacyTier } from '@/components/privacy-selector'
import { AllOptionsSheet, PillAction } from './floating-pill-parts'

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
  // Word-only
  onLookup?: () => void
  // Passage-only
  onAnalyze?: () => void
  // Both selection types
  onAsk?: () => void
  onTranslate?: () => void
  // Inline passage-comment action, only renders in passage mode and only when
  // the viewer belongs to a club currently reading this book.
  showClub?: boolean
  onClub?: () => void
  // Shared, both modes show Highlight. Privacy is selected inline after the
  // color pick. Callers translate to is_public.
  onHighlight: (color: HighlightColor, privacy: PrivacyTier) => void
  // Plus gating. When `locked` (the viewer is on the free tier), the AI
  // actions show a lock badge and route to `onUpgrade` instead of firing.
  locked?: boolean
  onUpgrade?: (feature: string) => void
}

interface PillActionDef {
  key: string
  label: string
  Icon: Icon
  onPress: () => void
  primary?: boolean
  // AI actions are Plus-gated; Highlight and Comment are not.
  gated?: boolean
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
  onAsk,
  onTranslate,
  showClub,
  onClub,
  onHighlight,
  locked,
  onUpgrade,
}: FloatingPillProps) {
  const colors = useColors()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const [showColors, setShowColors] = useState(false)
  // After a color is picked, the pill transitions to the privacy step so
  // the user can choose where the highlight is visible before it's written.
  const [pendingColor, setPendingColor] = useState<HighlightColor | null>(null)
  const [privacyDraft, setPrivacyDraft] = useState<PrivacyTier>('public')
  // Long-press shows the full labeled action list as a bottom sheet.
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

  // One contextual menu, actions adapt to the selection type. The first item
  // is the primary action (labeled, brand-filled); the rest are icon-only so
  // four or five actions fit inline on a phone. Long-press reveals the full
  // labeled list.
  const actions: PillActionDef[] =
    mode === 'word'
      ? [
          { key: 'lookup', label: 'Look up', Icon: MagnifyingGlass, onPress: () => onLookup?.(), primary: true, gated: true },
          { key: 'highlight', label: 'Highlight', Icon: Palette, onPress: () => setShowColors(true) },
          { key: 'translate', label: 'Translate', Icon: Translate, onPress: () => onTranslate?.(), gated: true },
          { key: 'ask', label: 'Ask', Icon: ChatCircle, onPress: () => onAsk?.(), gated: true },
        ]
      : [
          { key: 'analyze', label: 'Analyze', Icon: ClipboardText, onPress: () => onAnalyze?.(), primary: true, gated: true },
          { key: 'ask', label: 'Ask', Icon: ChatCircle, onPress: () => onAsk?.(), gated: true },
          { key: 'highlight', label: 'Highlight', Icon: Palette, onPress: () => setShowColors(true) },
          ...(showClub
            ? [{ key: 'comment', label: 'Comment', Icon: UsersThree, onPress: () => onClub?.() }]
            : []),
          { key: 'translate', label: 'Translate', Icon: Translate, onPress: () => onTranslate?.(), gated: true },
        ]

  // Pill width is content-driven: one labeled primary chip plus icon-only
  // chips and the dismiss button. Position above the selection with a gap;
  // drop below if it would clip the top chrome.
  const LABELED_W = 116
  const ICON_W = 42
  const DISMISS_W = 46
  const approxPillWidth = showColors
    ? 280
    : LABELED_W + (actions.length - 1) * ICON_W + DISMISS_W + 12
  const idealLeft = anchor.x + anchor.width / 2 - approxPillWidth / 2
  const left = Math.max(
    PILL_HORIZONTAL_PAD,
    Math.min(idealLeft, screenWidth - approxPillWidth - PILL_HORIZONTAL_PAD),
  )
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

  const ICON_SIZE = 18
  const iconColor = colors.brandText

  // Color-picker mode: swatch row inside the pill. After a color is picked
  // (pendingColor !== null) the pill swaps to a privacy selector + Save button.
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
        {actions.map((a, i) => {
          const isLocked = !!locked && !!a.gated
          return (
            <PillAction
              key={a.key}
              Icon={a.Icon}
              label={a.label}
              a11yLabel={isLocked ? `${a.label}, Plus feature` : a.label}
              primary={a.primary}
              iconOnly={!a.primary}
              autoFocus={i === 0}
              showLock={isLocked}
              onPress={() => (isLocked ? onUpgrade?.(a.label) : a.onPress())}
            />
          )
        })}

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
        locked={locked}
        onUpgrade={onUpgrade}
        onClose={() => setAllOptionsOpen(false)}
        onLookup={onLookup}
        onAnalyze={onAnalyze}
        onAsk={onAsk}
        onTranslate={onTranslate}
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

