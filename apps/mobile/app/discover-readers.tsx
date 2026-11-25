import { useSuggest } from "@foxing/client";
import { useState } from "react";
import { View, Text, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MagnifyingGlass } from "phosphor-react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { BackHeader } from "@/components/ui/back-header";
import { PersonRow } from "@/components/profile/person-row";

export default function DiscoverReadersScreen() {
  const colors = useColors();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const people = useSuggest(query).people;

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <BackHeader title="Find readers" />
      <View
        className="flex-row items-center mx-4 mb-3 px-3 py-2 rounded-full border"
        style={{ borderColor: colors.borderSubtle, backgroundColor: colors.bgSurface }}
      >
        <MagnifyingGlass color={colors.textTertiary} size={16} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus
          placeholder="Search by name or @username"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            flex: 1,
            fontFamily: Fonts.body,
            fontSize: 14,
            color: colors.textPrimary,
            marginLeft: 8,
          }}
        />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      >
        {query.trim().length < 2 ? (
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 13,
              color: colors.textTertiary,
              textAlign: "center",
              marginTop: 24,
            }}
          >
            Type 2+ letters.
          </Text>
        ) : people.length === 0 ? (
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 13,
              color: colors.textTertiary,
              textAlign: "center",
              marginTop: 24,
            }}
          >
            No readers match "{query.trim()}".
          </Text>
        ) : (
          people.map((p) => (
            <PersonRow
              key={p.username}
              person={p}
              onPress={() => router.push(`/u/${p.username}` as never)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
