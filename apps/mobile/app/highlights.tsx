import { useMyAnnotations } from "@foxing/client";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

import { highlightSwatch, useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { BackHeader } from "@/components/ui/back-header";
import { Screen } from "@/components/ui/screen";

// Every highlight the reader has made, newest first, from GET /annotations.
export default function HighlightsScreen() {
  const colors = useColors();
  const router = useRouter();
  const highlights = useMyAnnotations(["highlight"]);
  const rows = highlights.data ?? [];
  const loading = highlights.isPending;

  return (
    <Screen>
      <BackHeader title="Highlights" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color={colors.brandUi} />
          </View>
        ) : rows.length === 0 ? (
          <View className="items-center py-16 px-8">
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 14,
                color: colors.textTertiary,
                textAlign: "center",
              }}
            >
              {highlights.error ? "Could not load your highlights." : "No highlights yet."}
            </Text>
          </View>
        ) : (
          rows.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => {
                if (h.bookId) router.push(`/reader/${h.bookId}`);
              }}
              onLongPress={() => {
                if (!h.bookId || !h.selectedText) return;
                router.push(
                  `/quote-card?bookId=${h.bookId}&bookTitle=${encodeURIComponent(h.bookTitle ?? "")}&author=${encodeURIComponent(h.bookAuthor ?? "")}&passageText=${encodeURIComponent(h.selectedText)}` as never,
                );
              }}
              delayLongPress={350}
              className="mb-3 rounded-2xl flex-row overflow-hidden border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <View style={{ width: 4, backgroundColor: highlightSwatch(colors, h.color) }} />
              <View style={{ flex: 1, padding: 14 }}>
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 15,
                    color: colors.textPrimary,
                    lineHeight: 22,
                  }}
                  numberOfLines={4}
                >
                  {h.selectedText}
                </Text>
                {h.body ? (
                  <Text
                    style={{
                      fontFamily: Fonts.bodyItalic,
                      fontSize: 13,
                      color: colors.textSecondary,
                      marginTop: 6,
                    }}
                  >
                    “{h.body}”
                  </Text>
                ) : null}
                <View className="flex-row items-center justify-between" style={{ marginTop: 8 }}>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: Fonts.ui,
                      fontSize: 11,
                      color: colors.textTertiary,
                    }}
                    numberOfLines={1}
                  >
                    {[h.bookTitle ?? h.sourceTitle, h.bookAuthor].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
