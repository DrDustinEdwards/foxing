import { useBrowse } from "@foxing/client";
import { useState } from "react";
import { View, Text, Pressable, FlatList, Image, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BookOpen } from "phosphor-react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { BackHeader } from "@/components/ui/back-header";
import { Screen } from "@/components/ui/screen";

type FilterType = "subject" | "era" | "length";

export default function DiscoverFilterScreen() {
  const colors = useColors();
  const router = useRouter();
  const { type, value, label } = useLocalSearchParams<{
    type: FilterType;
    value: string;
    label?: string;
  }>();
  const [page, setPage] = useState(1);
  const browse = useBrowse({ [type ?? "subject"]: value, page });
  const rows = browse.data?.books ?? [];
  const loading = browse.isPending;
  const title = label ?? value ?? "";

  return (
    <Screen>
      <BackHeader title={title} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textTertiary,
              textAlign: "center",
            }}
          >
            {browse.isError ? "Couldn't load these books." : "Nothing matches."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(b) => b.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          columnWrapperStyle={{ gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          ListFooterComponent={
            browse.data && browse.data.pageCount > 1 ? (
              <View className="flex-row items-center justify-between" style={{ marginTop: 20 }}>
                <Pressable
                  onPress={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={{ opacity: page <= 1 ? 0.4 : 1 }}
                >
                  <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.brandUi }}>
                    Previous
                  </Text>
                </Pressable>
                <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary }}>
                  Page {browse.data.page} of {browse.data.pageCount}
                </Text>
                <Pressable
                  onPress={() => setPage((p) => p + 1)}
                  disabled={page >= browse.data.pageCount}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={{ opacity: page >= browse.data.pageCount ? 0.4 : 1 }}
                >
                  <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.brandUi }}>
                    Next
                  </Text>
                </Pressable>
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/book/${item.slug}` as never)}
              style={{ flex: 1, maxWidth: "48%" }}
            >
              <View
                style={{
                  aspectRatio: 2 / 3,
                  borderRadius: 6,
                  overflow: "hidden",
                  backgroundColor: colors.bgSunken,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                }}
              >
                {item.coverUrl ? (
                  <Image
                    source={{ uri: item.coverUrl }}
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <BookOpen color={colors.textTertiary} size={22} />
                )}
              </View>
              <Text
                style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <Text
                style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}
                numberOfLines={1}
              >
                {item.author}
              </Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
