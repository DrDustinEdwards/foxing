import { ApiError } from "@foxing/client";
import { Pressable, Text, View } from "react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

// A failed read: say so and let the reader retry. Never an empty state.
export function ErrorState({
  onRetry,
  message = "Couldn't load. Check your connection.",
}: {
  onRetry: () => void;
  message?: string;
}) {
  const colors = useColors();
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: "center",
        }}
      >
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry"
        className="mt-4 rounded-full px-5 py-2"
        style={{ backgroundColor: colors.brandUi }}
      >
        <Text style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textOnBrand }}>Retry</Text>
      </Pressable>
    </View>
  );
}

// A 404 is a real "not found"; any other failed read is an error to retry.
export function isNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}
