import { useColors } from "@/constants/colors";
import { Pressable, Text, View } from "react-native";
import { Fonts } from "@/constants/fonts";
import { SectionLabel } from "@/components/ui/section-label";

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 14 }}>
      <SectionLabel style={{ marginBottom: 8 }}>{label}</SectionLabel>
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
