import { useMyLists } from "@foxing/client";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Plus, Eye, EyeSlash } from "phosphor-react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { BackHeader } from "@/components/ui/back-header";
import { Screen } from "@/components/ui/screen";

// The reader's own lists from GET /lists; a create or delete elsewhere patches this.
export default function MyListsScreen() {
  const colors = useColors();
  const router = useRouter();
  const lists = useMyLists();
  const rows = lists.data ?? [];

  return (
    <Screen>
      <BackHeader title="My lists">
        <Pressable
          onPress={() => router.push("/lists/new" as never)}
          hitSlop={10}
          className="p-2"
          accessibilityRole="button"
          accessibilityLabel="New list"
        >
          <Plus color={colors.brandUi} size={22} weight="bold" />
        </Pressable>
      </BackHeader>

      {lists.isPending ? (
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
            {lists.error ? "Could not load your lists." : "No lists yet."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {rows.map((l) => (
            <Pressable
              key={l.id}
              onPress={() => router.push(`/lists/${l.id}` as never)}
              className="p-4 mb-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <View className="flex-row items-center" style={{ gap: 8, marginBottom: 4 }}>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: Fonts.uiMedium,
                    fontSize: 15,
                    color: colors.textPrimary,
                  }}
                  numberOfLines={1}
                >
                  {l.title}
                </Text>
                {l.isPublic ? (
                  <Eye color={colors.info} size={14} />
                ) : (
                  <EyeSlash color={colors.textTertiary} size={14} />
                )}
              </View>
              {l.description ? (
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginBottom: 6,
                  }}
                  numberOfLines={1}
                >
                  {l.description}
                </Text>
              ) : null}
              <Text
                style={{
                  fontFamily: Fonts.mono,
                  fontSize: 11,
                  color: colors.textTertiary,
                }}
              >
                {l.bookCount} book{l.bookCount === 1 ? "" : "s"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
