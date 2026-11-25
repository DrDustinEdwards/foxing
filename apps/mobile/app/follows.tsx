import { usePeople } from "@foxing/client";
import { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { UnderlineTabs } from "@/components/ui/underline-tabs";
import { ErrorState } from "@/components/ui/error-state";
import { BackHeader } from "@/components/ui/back-header";
import { FollowButton } from "@/components/profile/follow-button";
import { PersonRow } from "@/components/profile/person-row";

type Tab = "followers" | "following";

const FOLLOW_TABS: { key: Tab; label: string }[] = [
  { key: "following", label: "Following" },
  { key: "followers", label: "Followers" },
];

export default function FollowsScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === "followers" ? "followers" : "following");
  const people = usePeople();
  const following = people.data?.following ?? [];
  const followers = people.data?.followers ?? [];
  const open = (username: string) => router.push(`/u/${username}` as never);

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <BackHeader title="Connections" />

      <UnderlineTabs
        className="flex-row px-4 mb-4"
        tabs={FOLLOW_TABS}
        active={tab}
        onChange={setTab}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {people.isPending ? (
          <View className="py-12 items-center">
            <ActivityIndicator color={colors.brandUi} />
          </View>
        ) : people.isError && !people.data ? (
          <ErrorState onRetry={() => void people.refetch()} />
        ) : (tab === "following" ? following.length : followers.length) === 0 ? (
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 14,
              color: colors.textTertiary,
              textAlign: "center",
              paddingVertical: 48,
              paddingHorizontal: 24,
            }}
          >
            {tab === "following" ? "You're not following anyone yet." : "No followers yet."}
          </Text>
        ) : tab === "following" ? (
          following.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              onPress={() => open(p.username)}
              action={<FollowButton userId={p.id} isFollowing size="sm" />}
            />
          ))
        ) : (
          followers.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              onPress={() => open(p.username)}
              action={<FollowButton userId={p.id} isFollowing={p.isFollowing} size="sm" />}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
