import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CaretLeft, X as XIcon } from "phosphor-react-native";
import { useColors } from "@/constants/colors";

export function ReaderLoadOverlays({
  readerState,
  readerError,
  themeColors,
  onBack,
}: {
  readerState: "loading" | "ready" | "error";
  readerError: string | null;
  themeColors: { background: string; text: string };
  onBack: () => void;
}) {
  const colors = useColors();
  return (
    <>
      {readerState === "loading" ? (
        <View
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center"
          style={{ backgroundColor: themeColors.background }}
        >
          <ActivityIndicator color={colors.brandUi} />
          <Text className="font-ui mt-3 text-sm" style={{ color: themeColors.text, opacity: 0.7 }}>
            Loading book…
          </Text>
        </View>
      ) : null}

      {readerState === "error" ? (
        <View
          className="absolute inset-0 items-center justify-center px-6"
          style={{ backgroundColor: themeColors.background }}
        >
          <View className="flex-row items-center gap-2 mb-3">
            <XIcon color={colors.error} size={20} />
            <Text
              className="font-ui-medium text-lg text-center"
              style={{ color: themeColors.text }}
            >
              We couldn't open this book.
            </Text>
          </View>
          <Text
            className="font-ui text-sm mb-6 text-center"
            style={{ color: themeColors.text, opacity: 0.7 }}
          >
            {readerError}
          </Text>
          <Pressable onPress={() => onBack()} className="flex-row items-center">
            <CaretLeft color={colors.brandUi} size={18} />
            <Text className="font-ui text-base ml-1" style={{ color: colors.brandUi }}>
              Back to library
            </Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

export function ReaderPending() {
  const colors = useColors();
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
      <ActivityIndicator color={colors.brandUi} />
    </SafeAreaView>
  );
}

export function ReaderMissingBook({ onBack }: { onBack: () => void }) {
  const colors = useColors();
  return (
    <SafeAreaView className="flex-1 items-center justify-center px-8 bg-bg-base-light dark:bg-bg-base-dark">
      <Text className="font-ui mb-4 text-text-primary-light dark:text-text-primary-dark">
        We couldn't load that book.
      </Text>
      <Pressable onPress={onBack} className="flex-row items-center">
        <CaretLeft color={colors.brandText} size={18} />
        <Text className="font-ui text-brand-text-light dark:text-brand-text-dark ml-1">Back</Text>
      </Pressable>
    </SafeAreaView>
  );
}
