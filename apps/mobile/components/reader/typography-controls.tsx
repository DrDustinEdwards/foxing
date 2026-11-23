import { FONT_SIZE_PX, type FontSizeStep } from "@/lib/reader-settings";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Pressable, Text, View } from "react-native";

export function PreviewBox({ fontSize }: { fontSize: FontSizeStep }) {
  const colors = useColors();
  const px = FONT_SIZE_PX[fontSize];
  return (
    <View
      className="mt-3 rounded-2xl p-4 border"
      style={{ backgroundColor: colors.bgReading, borderColor: colors.borderSubtle }}
    >
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: px,
          lineHeight: px * 1.7,
          color: colors.textPrimary,
        }}
      >
        The fox knew of foxing too: pages mottled with brown spots, the way time itself reads a
        beloved book.
      </Text>
    </View>
  );
}

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View className="mb-5">
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 12,
          color: colors.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

export function StepRow<T extends string>({
  steps,
  value,
  labelFor,
  onSelect,
}: {
  steps: T[];
  value: T;
  labelFor: (s: T) => string;
  onSelect: (v: T) => void;
}) {
  const colors = useColors();
  return (
    <View className="flex-row gap-1.5">
      {steps.map((s) => {
        const active = s === value;
        return (
          <Pressable
            key={s}
            onPress={() => onSelect(s)}
            className="flex-1 rounded-xl py-2.5 items-center"
            style={{
              backgroundColor: active ? colors.brandUi : colors.bgSurface,
              borderWidth: 1,
              borderColor: active ? colors.brandUi : colors.borderSubtle,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: active ? colors.textOnBrand : colors.textPrimary,
              }}
            >
              {labelFor(s)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
