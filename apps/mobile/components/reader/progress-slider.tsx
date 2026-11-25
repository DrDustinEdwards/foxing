import { useEffect, useRef, useState } from "react";
import { View, Text, PanResponder, type LayoutChangeEvent } from "react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

interface ProgressSliderProps {
  value: number;
  onSlidingComplete: (fraction: number) => void;
  onSlidingChange?: (fraction: number) => void;
}

// Custom PanResponder slider: the community slider is an extra native dep and does not expose an unquantized 0..1 fraction.
export function ProgressSlider({ value, onSlidingComplete, onSlidingChange }: ProgressSliderProps) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(value);
  const previewRef = useRef(value);

  const widthRef = useRef(0);
  const callbacks = useRef({ onSlidingChange, onSlidingComplete });
  useEffect(() => {
    callbacks.current = { onSlidingChange, onSlidingComplete };
  });

  const handleLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };

  // oxlint-disable-next-line react/refs -- the handlers read the refs during a gesture, never during render
  const [responder] = useState(() => {
    const computeFraction = (touchX: number): number => {
      const w = widthRef.current;
      if (w <= 0) return 0;
      return Math.max(0, Math.min(1, touchX / w));
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        setDragging(true);
        const f = computeFraction(e.nativeEvent.locationX);
        previewRef.current = f;
        setPreview(f);
        callbacks.current.onSlidingChange?.(f);
      },
      onPanResponderMove: (e) => {
        const f = computeFraction(e.nativeEvent.locationX);
        previewRef.current = f;
        setPreview(f);
        callbacks.current.onSlidingChange?.(f);
      },
      onPanResponderRelease: () => {
        setDragging(false);
        callbacks.current.onSlidingComplete(previewRef.current);
      },
      onPanResponderTerminate: () => {
        setDragging(false);
      },
    });
  });

  const fraction = dragging ? preview : value;
  const filled = Math.max(0, Math.min(1, fraction));

  return (
    <View
      onLayout={handleLayout}
      style={{ paddingVertical: 8 }}
      accessibilityRole="adjustable"
      accessibilityLabel={`Reading progress ${Math.round(filled * 100)} percent`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(filled * 100) }}
      {...responder.panHandlers}
    >
      <View
        pointerEvents="none"
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.borderSubtle,
          overflow: "visible",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            height: "100%",
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
              position: "absolute",
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
            position: "absolute",
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
  );
}
