import { type ReactNode } from "react";
import { type StyleProp, Text, type TextStyle, View } from "react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

// The small uppercase heading above a group of rows. Spacing is the caller's.
export function SectionLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const colors = useColors();
  return (
    <Text
      style={[
        {
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// A SectionLabel over its content, with the gap the lists on a screen share.
export function SectionBlock({
  title,
  inset = 16,
  children,
}: {
  title: string;
  inset?: number;
  children: ReactNode;
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <SectionLabel style={{ marginBottom: 10, paddingHorizontal: inset }}>{title}</SectionLabel>
      {children}
    </View>
  );
}
