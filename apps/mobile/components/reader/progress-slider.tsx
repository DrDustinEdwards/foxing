import { useRef, useState } from 'react'
import { View, Text, PanResponder, type LayoutChangeEvent } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface ProgressSliderProps {
  // Current progress in 0..1. Reflected as the filled portion of the
  // track when the user isn't dragging.
  value: number
  // Fires only on finger lift, NOT on every drag tick. The host calls
  // jumpToProgress(fraction) here so we don't slam goTo every pixel.
  onSlidingComplete: (fraction: number) => void
  // Optional preview-percent callback fired on every move so a caller
  // can mirror the dragged-to value in chrome text. Throttled to once
  // per render tick.
  onSlidingChange?: (fraction: number) => void
}

// Custom slider built on PanResponder. We don't pull in
// @react-native-community/slider because (a) it's an extra native dep
// for one Kindle-style control and (b) we already need to read out a
// 0..1 fraction with no float quantization, which the community slider
// doesn't expose cleanly.
export function ProgressSlider({
  value,
  onSlidingComplete,
  onSlidingChange,
}: ProgressSliderProps) {
  const colors = useColors()
  const [width, setWidth] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(value)
  // Latest fraction stored in a ref so onPanResponderRelease (a stale
  // closure if state-bound) always sees the freshest drag position.
  const previewRef = useRef(value)

  const handleLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
  }

  const computeFraction = (touchX: number): number => {
    if (width <= 0) return 0
    return Math.max(0, Math.min(1, touchX / width))
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        setDragging(true)
        const f = computeFraction(e.nativeEvent.locationX)
        previewRef.current = f
        setPreview(f)
        onSlidingChange?.(f)
      },
      onPanResponderMove: (e) => {
        const f = computeFraction(e.nativeEvent.locationX)
        previewRef.current = f
        setPreview(f)
        onSlidingChange?.(f)
      },
      onPanResponderRelease: () => {
        setDragging(false)
        onSlidingComplete(previewRef.current)
      },
      onPanResponderTerminate: () => {
        setDragging(false)
      },
    }),
  ).current

  const fraction = dragging ? preview : value
  const filled = Math.max(0, Math.min(1, fraction))

  return (
    <View
      onLayout={handleLayout}
      // Padding around the visual bar gives a generous touch target
      // without making the rendered track tall.
      style={{ paddingVertical: 8 }}
      accessibilityRole="adjustable"
      accessibilityLabel={`Reading progress ${Math.round(filled * 100)} percent`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(filled * 100) }}
      {...responder.panHandlers}
    >
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.borderSubtle,
          overflow: 'visible',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${filled * 100}%`,
            borderRadius: 2,
            backgroundColor: colors.brandUi,
          }}
        />
        {/* Thumb. Slightly taller and wider than the track; only shown
            while dragging to keep the resting state minimal. */}
        {dragging ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -6,
              left: width * filled - 8,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: colors.brandUi,
            }}
          />
        ) : null}
      </View>
      {dragging ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -22,
            left: Math.max(0, Math.min(width - 40, width * filled - 20)),
            backgroundColor: colors.bgElevated,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.mono,
              fontSize: 10,
              color: colors.textPrimary,
            }}
          >
            {Math.round(filled * 100)}%
          </Text>
        </View>
      ) : null}
    </View>
  )
}
