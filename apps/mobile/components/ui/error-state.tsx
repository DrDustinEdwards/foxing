import { ApiError } from "@foxing/client";
import { Pressable, Text, View } from "react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { BackHeader } from "@/components/ui/back-header";
import { Screen } from "@/components/ui/screen";

export function ErrorState({
  onRetry,
  message = "Couldn't load. Check your connection.",
}: {
  onRetry?: () => void;
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
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          className="mt-4 rounded-full px-5 py-2"
          style={{ backgroundColor: colors.brandUi }}
        >
          <Text style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textOnBrand }}>
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function isNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

export function ErrorScreen({
  query,
  notFound,
}: {
  query: { isError: boolean; error: unknown; refetch: () => unknown };
  notFound: string;
}) {
  const failed = query.isError && !isNotFound(query.error);
  return (
    <Screen>
      <BackHeader title="" />
      <ErrorState
        message={failed ? undefined : notFound}
        onRetry={failed ? () => void query.refetch() : undefined}
      />
    </Screen>
  );
}
