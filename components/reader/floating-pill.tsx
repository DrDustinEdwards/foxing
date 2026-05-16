import { useEffect, useState } from 'react'
import { View, Text, Pressable, useWindowDimensions } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// Seven Foxing highlight colors. Order matches design-system.md and is
// tuned for spectrum visibility — warm tones first, cool last.
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
  // Shared — both modes show Highlight
  onHighlight: (color: HighlightColor) => void
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
  onHighlight,
}: FloatingPillProps) {
  const colors = useColors()
  const { width: screenWidth } = useWindowDimensions()
  const [showColors, setShowColors] = useState(false)

  // Reset color picker when the pill closes or the anchor changes
  // (new word tap shouldn't inherit prior color-mode state).
  useEffect(() => {
    if (!visible) setShowColors(false)
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
  const approxPillWidth = showColors ? 280 : (mode === 'word' ? 200 : 280)
  const idealLeft = anchor.x + anchor.width / 2 - approxPillWidth / 2
  const left = Math.max(
    PILL_HORIZONTAL_PAD,
    Math.min(idealLeft, screenWidth - approxPillWidth - PILL_HORIZONTAL_PAD),
  )
  // Default: place pill above the anchor.
  const aboveTop = anchor.y - PILL_HEIGHT - PILL_VERTICAL_GAP
  // Fallback: if there isn't room above, drop below.
  const top = aboveTop < 60 ? anchor.y + anchor.height + PILL_VERTICAL_GAP : aboveTop

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
    marginLeft: 4,
  }

  const iconStyle = {
    fontFamily: Fonts.uiMedium,
    fontSize: 15,
    color: colors.brandText,
  }

  // Color-picker mode: swatch row inside the pill.
  if (showColors) {
    return (
      <View style={pillStyle}>
        {HIGHLIGHT_COLORS.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Highlight ${c}`}
            onPress={() => {
              onHighlight(c)
              onDismiss()
            }}
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
          <Text style={iconStyle}>✕</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={pillStyle}>
      {mode === 'word' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Look up word"
          onPress={() => {
            onLookup?.()
            // Don't dismiss here — caller may want the pill to stay; word
            // sheet provides its own UI. Caller can pass onDismiss in onLookup.
          }}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 }}
        >
          <Text style={iconStyle}>🔍</Text>
          <Text style={labelStyle}>Look up</Text>
        </Pressable>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Analyze passage"
            onPress={() => onAnalyze?.()}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 }}
          >
            <Text style={iconStyle}>📋</Text>
            <Text style={labelStyle}>Analyze</Text>
          </Pressable>
          <View style={{ width: 1, height: 22, backgroundColor: colors.borderSubtle, marginHorizontal: 4 }} />
        </>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Highlight"
        onPress={() => setShowColors(true)}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 }}
      >
        <Text style={iconStyle}>🎨</Text>
        <Text style={labelStyle}>Highlight</Text>
      </Pressable>

      {mode === 'passage' && (
        <>
          <View style={{ width: 1, height: 22, backgroundColor: colors.borderSubtle, marginHorizontal: 4 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Discuss passage"
            onPress={() => onDiscuss?.()}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 }}
          >
            <Text style={iconStyle}>💬</Text>
            <Text style={labelStyle}>Discuss</Text>
          </Pressable>
        </>
      )}

      <View style={{ width: 1, height: 22, backgroundColor: colors.borderSubtle, marginHorizontal: 4 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss pill"
        onPress={onDismiss}
        style={{ paddingHorizontal: 10, paddingVertical: 8 }}
      >
        <Text style={iconStyle}>✕</Text>
      </Pressable>
    </View>
  )
}
