import { useClubPage, useJoinClub, useLeaveClub } from "@foxing/client";
import type * as W from "@foxing/types";
import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChatCircle, BookOpen, UsersThree, Info, ShareNetwork } from "phosphor-react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { authClient } from "@/lib/api";
import { DiscussionStarterSheet } from "@/components/clubs/discussion-starter-sheet";
import { ClubJoinCta } from "@/components/clubs/club-join-cta";
import {
  DiscussionsTab,
  ReadingTab,
  MembersTab,
  AboutTab,
} from "@/components/clubs/club-detail-tabs";
import { ErrorScreen } from "@/components/ui/error-state";
import { NewThreadSheet } from "@/components/clubs/new-thread-sheet";
import { BackHeader } from "@/components/ui/back-header";
import { Screen } from "@/components/ui/screen";

type Tab = "discussions" | "reading" | "members" | "about";

export default function ClubDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = authClient.useSession();
  const signedIn = !!session.data;
  const clubPage = useClubPage(id ?? "");
  const page = clubPage.data;
  const join = useJoinClub();
  const leave = useLeaveClub();
  const [tab, setTab] = useState<Tab>("discussions");
  const [starterOpen, setStarterOpen] = useState(false);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [threadQuery, setThreadQuery] = useState("");

  const sortedThreads = useMemo(() => {
    const threads = page?.threads ?? [];
    const q = threadQuery.trim().toLowerCase();
    const filtered = q ? threads.filter((t) => t.title.toLowerCase().includes(q)) : threads;
    return [...filtered].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  }, [threadQuery, page?.threads]);

  const scheduleByGate = useMemo(
    () => new Map((page?.schedule ?? []).map((r) => [r.chapterName, r.unlockDate])),
    [page?.schedule],
  );

  const [now] = useState(() => Date.now());
  const nextUnlock = useMemo(() => {
    const future = (page?.schedule ?? []).map((r) => r.unlockDate).filter((t) => t > now);
    return future.length > 0 ? Math.min(...future) : null;
  }, [page?.schedule, now]);

  const isLocked = useCallback(
    (t: W.ClubThreadItem) => {
      if (!t.chapter) return false;
      const unlock = scheduleByGate.get(t.chapter);
      return unlock !== undefined && unlock > Date.now();
    },
    [scheduleByGate],
  );

  if (clubPage.isPending) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator color={colors.brandUi} />
      </Screen>
    );
  }

  if (!page) return <ErrorScreen query={clubPage} notFound="We couldn't find that club." />;
  const club = page.club;

  return (
    <Screen>
      <BackHeader title={club.name}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/quote-card",
              params: {
                type: "club_invite",
                clubId: club.id,
                clubName: club.name,
                bookId: club.currentBook?.id ?? "",
                bookTitle: club.currentBook?.title ?? "",
                author: club.currentBook?.author ?? "",
                coverUrl: club.currentBook?.coverUrl ?? "",
                memberCount: String(club.memberCount),
              },
            } as never)
          }
          hitSlop={6}
          style={{ padding: 6, marginRight: 4 }}
          accessibilityLabel="Share club invite"
        >
          <ShareNetwork color={colors.textPrimary} size={18} />
        </Pressable>
        <ClubJoinCta
          page={page}
          busy={join.pending || leave.pending}
          onJoin={() =>
            signedIn ? join.fire({ clubId: club.id }) : router.push("/(auth)/login" as never)
          }
          onLeave={() => leave.fire({ clubId: club.id })}
        />
      </BackHeader>

      <View className="flex-row px-2 mb-2">
        <TabButton
          tab="discussions"
          current={tab}
          setTab={setTab}
          icon={ChatCircle}
          label="Discussions"
        />
        <TabButton tab="reading" current={tab} setTab={setTab} icon={BookOpen} label="Reading" />
        <TabButton tab="members" current={tab} setTab={setTab} icon={UsersThree} label="Members" />
        <TabButton tab="about" current={tab} setTab={setTab} icon={Info} label="About" />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        {tab === "discussions" ? (
          <DiscussionsTab
            club={club}
            threads={sortedThreads}
            canPost={page.isMember}
            query={threadQuery}
            setQuery={setThreadQuery}
            nextUnlock={nextUnlock}
            isLocked={isLocked}
            onAiStarter={() => setStarterOpen(true)}
            onNewThread={() => setNewThreadOpen(true)}
            onOpen={(t) => {
              if (isLocked(t)) return;
              router.push(`/clubs/thread/${t.id}` as never);
            }}
          />
        ) : tab === "reading" ? (
          <ReadingTab
            page={page}
            signedIn={signedIn}
            onOpenBook={(slug) => router.push(`/book/${slug}` as never)}
          />
        ) : tab === "members" ? (
          <MembersTab
            members={page.members.filter((m) => m.status === "active")}
            onOpenMember={(username) => router.push(`/u/${username}` as never)}
          />
        ) : (
          <AboutTab club={club} threadCount={page.threads.length} />
        )}
      </ScrollView>

      <DiscussionStarterSheet
        visible={starterOpen}
        clubId={club.id}
        bookTitle={club.currentBook?.title ?? null}
        bookId={club.currentBook?.id ?? null}
        onClose={() => setStarterOpen(false)}
        onPosted={(threadId) => {
          setStarterOpen(false);
          router.push(`/clubs/thread/${threadId}` as never);
        }}
      />

      <NewThreadSheet
        visible={newThreadOpen}
        clubId={club.id}
        defaultChapter=""
        onClose={() => setNewThreadOpen(false)}
        onPosted={(threadId) => {
          setNewThreadOpen(false);
          router.push(`/clubs/thread/${threadId}` as never);
        }}
      />
    </Screen>
  );
}

function TabButton({
  tab,
  current,
  setTab,
  icon: Icon,
  label,
}: {
  tab: Tab;
  current: Tab;
  setTab: (t: Tab) => void;
  icon: React.ComponentType<{ color: string; size: number; weight?: "regular" | "bold" }>;
  label: string;
}) {
  const colors = useColors();
  const active = tab === current;
  return (
    <Pressable
      onPress={() => setTab(tab)}
      className="flex-1 items-center py-2"
      style={{
        borderBottomWidth: 2,
        borderBottomColor: active ? colors.borderInteractive : colors.borderSubtle,
      }}
    >
      <View className="flex-row items-center gap-1">
        <Icon color={active ? colors.brandText : colors.textTertiary} size={14} weight="regular" />
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 12,
            color: active ? colors.brandText : colors.textTertiary,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
