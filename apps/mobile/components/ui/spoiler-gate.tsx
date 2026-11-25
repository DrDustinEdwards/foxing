import type { ComponentProps } from "react";
import { View, Text, Pressable } from "react-native";
import { Eye, EyeSlash } from "phosphor-react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

export function Byline({
  name,
  meta,
  onPressName,
}: {
  name: string;
  meta: string;
  onPressName?: () => void;
}) {
  const colors = useColors();
  return (
    <View className="flex-row items-center" style={{ marginBottom: 2 }}>
      <Text
        onPress={onPressName}
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 13,
          color: colors.textPrimary,
          marginRight: 6,
        }}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>{meta}</Text>
    </View>
  );
}

/** A post or comment body that can sit behind a tap-to-reveal veil. */
export function SpoilerGate({
  hidden,
  gated,
  body,
  hiddenLabel,
  shownLabel,
  onToggle,
  accessibilityRole,
}: {
  hidden: boolean;
  gated: boolean;
  body: string | null;
  hiddenLabel: string;
  shownLabel: string;
  onToggle: () => void;
  accessibilityRole?: ComponentProps<typeof Pressable>["accessibilityRole"];
}) {
  const colors = useColors();
  if (hidden) {
    return (
      <Pressable onPress={onToggle} accessibilityRole={accessibilityRole}>
        <View
          style={{
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: colors.bgSelected,
            borderColor: colors.borderBrand,
            borderWidth: 1,
            borderStyle: "dashed",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <EyeSlash color={colors.brandText} size={14} weight="regular" />
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}>
            {hiddenLabel}
          </Text>
        </View>
      </Pressable>
    );
  }
  return (
    <>
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: 14,
          color: colors.textPrimary,
          lineHeight: 21,
        }}
      >
        {body}
      </Text>
      {gated ? (
        <Pressable onPress={onToggle} className="flex-row items-center gap-1 mt-2">
          <Eye color={colors.textTertiary} size={11} />
          <Text style={{ fontFamily: Fonts.ui, fontSize: 10, color: colors.textTertiary }}>
            {shownLabel}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}
