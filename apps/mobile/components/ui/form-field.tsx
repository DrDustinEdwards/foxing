import { View, Text } from "react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 12,
          color: colors.textTertiary,
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

export function inputStyle(colors: ReturnType<typeof useColors>) {
  return {
    fontFamily: Fonts.ui,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  } as const;
}

export function FieldLabel({
  children,
  marginTop = 12,
}: {
  children: React.ReactNode;
  marginTop?: number;
}) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontFamily: Fonts.uiMedium,
        fontSize: 12,
        color: colors.textTertiary,
        marginTop,
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: 0.6,
      }}
    >
      {children}
    </Text>
  );
}

export function SheetError({ message }: { message: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        marginTop: 16,
        padding: 12,
        borderRadius: 12,
        backgroundColor: colors.errorBg,
      }}
    >
      <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.error }}>{message}</Text>
    </View>
  );
}

export function StepHint({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontFamily: Fonts.body,
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 20,
        lineHeight: 20,
      }}
    >
      {children}
    </Text>
  );
}
