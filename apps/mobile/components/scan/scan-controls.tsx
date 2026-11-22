import { useColors } from "@/constants/colors";
import { Pressable, Text, View } from "react-native";
import { Fonts } from "@/constants/fonts";

export function Section({
  colors,
  label,
  children,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

export function PillBtn({
  label,
  onPress,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline";
}) {
  const colors = useColors();
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        ...(primary
          ? { backgroundColor: colors.brandUi }
          : { borderWidth: 1, borderColor: colors.borderInteractive }),
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          color: primary ? colors.textOnBrand : colors.textPrimary,
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
