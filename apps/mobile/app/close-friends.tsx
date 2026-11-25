import { useCloseFriend, usePeople } from "@foxing/client";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X as XIcon, Plus } from "phosphor-react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { ErrorState } from "@/components/ui/error-state";
import { BackHeader } from "@/components/ui/back-header";
import { PersonRow } from "@/components/profile/person-row";
import { SectionLabel } from "@/components/ui/section-label";

export default function CloseFriendsScreen() {
  const colors = useColors();
  const router = useRouter();
  const people = usePeople();
  const closeFriend = useCloseFriend();
  const friends = people.data?.closeFriends ?? [];
  const candidates = (people.data?.following ?? []).filter((p) => !p.isClose);
  const open = (username: string) => router.push(`/u/${username}` as never);

  const toggle = (userId: string, on: boolean, label: string) => (
    <Pressable
      onPress={() => closeFriend.fire({ userId, on })}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        on ? `Add ${label} to close friends` : `Remove ${label} from close friends`
      }
      style={{ padding: 6 }}
    >
      {on ? (
        <Plus color={colors.brandText} size={18} weight="bold" />
      ) : (
        <XIcon color={colors.textSecondary} size={18} />
      )}
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <BackHeader title="Close Friends" />
      {people.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : people.isError && !people.data ? (
        <ErrorState onRetry={() => void people.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          <Heading>Your close friends</Heading>
          {friends.length === 0 ? (
            <Note>Add people you trust from the readers you follow below.</Note>
          ) : (
            friends.map((f) => (
              <PersonRow
                key={f.id}
                person={f}
                onPress={() => open(f.username)}
                action={toggle(f.id, false, f.displayName ?? f.username)}
              />
            ))
          )}
          <View style={{ height: 18 }} />
          <Heading>Add from people you follow</Heading>
          {candidates.length === 0 ? (
            <Note>
              {friends.length > 0
                ? "Everyone you follow is already a close friend."
                : "Follow a few readers first, then add them here."}
            </Note>
          ) : (
            candidates.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                onPress={() => open(p.username)}
                action={toggle(p.id, true, p.displayName ?? p.username)}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <SectionLabel style={{ marginBottom: 8 }}>{children}</SectionLabel>;
}

function Note({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark">
      <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textTertiary }}>
        {children}
      </Text>
    </View>
  );
}
