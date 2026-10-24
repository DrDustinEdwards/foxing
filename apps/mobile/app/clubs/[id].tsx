import { useClubPage, useJoinClub, useLeaveClub } from '@foxing/client'
import type * as W from '@foxing/types'
import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft, ChatCircle, BookOpen, UsersThree, Info, ShareNetwork } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { authClient } from '@/lib/api'
import { DiscussionStarterSheet } from '@/components/clubs/discussion-starter-sheet'
import { ClubJoinCta } from '@/components/clubs/club-join-cta'
import { DiscussionsTab, ReadingTab, MembersTab, AboutTab } from '@/components/clubs/club-detail-tabs'
import { NewThreadSheet } from '@/components/clubs/new-thread-sheet'

type Tab = 'discussions' | 'reading' | 'members' | 'about'

// A club: the shared GET /clubs/:id page (threads, members, polls, meetings and the
// reading schedule in one object). Joins, votes and RSVPs patch or refetch it.
export default function ClubDetailScreen() {
  const colors = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const session = authClient.useSession()
  const signedIn = !!session.data
  const clubPage = useClubPage(id ?? '')
  const page = clubPage.data
  const join = useJoinClub()
  const leave = useLeaveClub()
  const [tab, setTab] = useState<Tab>('discussions')
  const [starterOpen, setStarterOpen] = useState(false)
  const [newThreadOpen, setNewThreadOpen] = useState(false)
  const [threadQuery, setThreadQuery] = useState('')

  const sortedThreads = useMemo(() => {
    const threads = page?.threads ?? []
    const q = threadQuery.trim().toLowerCase()
    const filtered = q ? threads.filter((t) => t.title.toLowerCase().includes(q)) : threads
    return [...filtered].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return b.createdAt - a.createdAt
    })
  }, [threadQuery, page?.threads])

  // Threads gated to a chapter stay locked until the schedule unlocks it.
  const scheduleByGate = useMemo(
    () => new Map((page?.schedule ?? []).map((r) => [r.chapterName, r.unlockDate])),
    [page?.schedule],
  )

  // Earliest future unlock, drives the "Next chapter unlocks in Xd Yh" header.
  const nextUnlock = useMemo(() => {
    const now = Date.now()
    const future = (page?.schedule ?? []).map((r) => r.unlockDate).filter((t) => t > now)
    return future.length > 0 ? Math.min(...future) : null
  }, [page?.schedule])

  const isLocked = useCallback(
    (t: W.ClubThreadItem) => {
      if (!t.chapter) return false
      const unlock = scheduleByGate.get(t.chapter)
      return unlock !== undefined && unlock > Date.now()
    },
    [scheduleByGate],
  )

  if (clubPage.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }

  if (!page) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8 bg-bg-base-light dark:bg-bg-base-dark">
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textTertiary, textAlign: 'center' }}
        >
          We couldn't find that club.
        </Text>
        <Pressable onPress={() => router.back()} className="flex-row items-center mt-3">
          <CaretLeft color={colors.brandText} size={18} />
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText, marginLeft: 4 }}>
            Back
          </Text>
        </Pressable>
      </SafeAreaView>
    )
  }
  const club = page.club

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 18,
            color: colors.textPrimary,
            marginLeft: 4,
            flex: 1,
          }}
        >
          {club.name}
        </Text>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/quote-card',
              params: {
                type: 'club_invite',
                clubId: club.id,
                clubName: club.name,
                bookId: club.currentBook?.id ?? '',
                bookTitle: club.currentBook?.title ?? '',
                author: club.currentBook?.author ?? '',
                coverUrl: club.currentBook?.coverUrl ?? '',
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
          onJoin={() => (signedIn ? join.fire({ clubId: club.id }) : router.push('/(auth)/login' as never))}
          onLeave={() => leave.fire({ clubId: club.id })}
        />
      </View>

      <View className="flex-row px-2 mb-2">
        <TabButton tab="discussions" current={tab} setTab={setTab} icon={ChatCircle} label="Discussions" />
        <TabButton tab="reading" current={tab} setTab={setTab} icon={BookOpen} label="Reading" />
        <TabButton tab="members" current={tab} setTab={setTab} icon={UsersThree} label="Members" />
        <TabButton tab="about" current={tab} setTab={setTab} icon={Info} label="About" />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        {tab === 'discussions' ? (
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
              if (isLocked(t)) return
              router.push(`/clubs/thread/${t.id}` as never)
            }}
          />
        ) : tab === 'reading' ? (
          <ReadingTab
            page={page}
            signedIn={signedIn}
            onOpenBook={(slug) => router.push(`/book/${slug}` as never)}
          />
        ) : tab === 'members' ? (
          <MembersTab
            members={page.members.filter((m) => m.status === 'active')}
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
          setStarterOpen(false)
          router.push(`/clubs/thread/${threadId}` as never)
        }}
      />

      <NewThreadSheet
        visible={newThreadOpen}
        clubId={club.id}
        defaultChapter=""
        onClose={() => setNewThreadOpen(false)}
        onPosted={(threadId) => {
          setNewThreadOpen(false)
          router.push(`/clubs/thread/${threadId}` as never)
        }}
      />
    </SafeAreaView>
  )
}

// ── Tabs ─────────────────────────────────────────────────────────────────

function TabButton({
  tab,
  current,
  setTab,
  icon: Icon,
  label,
}: {
  tab: Tab
  current: Tab
  setTab: (t: Tab) => void
  icon: React.ComponentType<{ color: string; size: number; weight?: 'regular' | 'bold' }>
  label: string
}) {
  const colors = useColors()
  const active = tab === current
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
  )
}

