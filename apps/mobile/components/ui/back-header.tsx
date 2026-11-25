import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

export function BackHeader({
  title,
  children,
  onBack,
}: {
  title?: string;
  children?: ReactNode;
  onBack?: () => void;
}) {
  const colors = useColors();
  const router = useRouter();
  return (
    <View className="flex-row items-center px-3 py-2">
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={10}
        className="p-2"
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <CaretLeft color={colors.textPrimary} size={22} />
      </Pressable>
      {title ? (
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: Fonts.display,
            fontSize: 18,
            color: colors.textPrimary,
            marginLeft: 4,
          }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
