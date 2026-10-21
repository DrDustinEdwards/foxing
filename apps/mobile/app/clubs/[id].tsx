import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import {
  CaretLeft,
  ChatCircle,
  BookOpen,
  UsersThree,
  Info,
  ShareNetwork,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  type ClubMember,
  type ClubRole,
  type ClubScheduleRow,
  type ClubStats,
  type ClubThread,
  type ClubWithBook,
  fetchClub,
  fetchMembers,
  getClubSchedule,
  getClubStats,
  getWaitlistPosition,
  isMember,
  joinClub,
  joinWaitlist,
  leaveClub,
} from '@/lib/clubs'
import { fetchThreads } from '@/lib/club-threads'
import { DiscussionStarterSheet } from '@/components/clubs/discussion-starter-sheet'
import { ClubJoinCta } from '@/components/clubs/club-join-cta'
import {
  DiscussionsTab,
  ReadingTab,
  MembersTab,
  AboutTab,
} from '@/components/clubs/club-detail-tabs'
import { NewThreadSheet } from '@/components/clubs/new-thread-sheet'

type Tab = 'discussions' | 'reading' | 'members' | 'about'

export default function ClubDetailScreen() {
  const colors = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [club, setClub] = useState<ClubWithBook | null>(null)
  const [members, setMembers] = useState<ClubMember[]>([])
  const [threads, setThreads] = useState<ClubThread[]>([])
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [role, setRole] = useState<ClubRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('discussions')
  const [starterOpen, setStarterOpen] = useState(false)
  const [newThreadOpen, setNewThreadOpen] = useState(false)
  const [busyJoin, setBusyJoin] = useState(false)
  const [schedule, setSchedule] = useState<ClubScheduleRow[]>([])
  const [stats, setStats] = useState<ClubStats | null>(null)
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null)
  const [threadQuery, setThreadQuery] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const viewer = user?.id ?? null
    setViewerId(viewer)
    const [c, m, t, r, sch, st, wlp] = await Promise.all([
      fetchClub(id),
      fetchMembers(id),
      fetchThreads(id),
      viewer ? isMember(id, viewer) : Promise.resolve(null),
      getClubSchedule(id),
      getClubStats(id),
      viewer ? getWaitlistPosition(id) : Promise.resolve(null),
    ])
    setClub(c)
    setMembers(m)
    setThreads(t)
    setRole(r)
    setSchedule(sch)
    setStats(st)
    setWaitlistPosition(wlp)
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useFocusEffect(
    useCallback(() => {
      // Refresh on focus so coming back from a thread shows updated counts.
      load()
    }, [load]),
  )

  const handleJoin = useCallback(async () => {
    if (!club || busyJoin) return
    setBusyJoin(true)
    // If the club is capped and full, route to the waitlist instead.
    const isFull =
      typeof club.max_members === 'number' &&
      club.max_members > 0 &&
      club.member_count >= club.max_members
    if (isFull) {
      const pos = await joinWaitlist(club.id)
      setWaitlistPosition(pos)
      setBusyJoin(false)
      return
    }
    const ok = await joinClub(club.id)
    setBusyJoin(false)
    if (ok) load()
  }, [busyJoin, club, load])

  const handleLeave = useCallback(async () => {
    if (!club || busyJoin) return
    setBusyJoin(true)
    const ok = await leaveClub(club.id)
    setBusyJoin(false)
    if (ok) load()
  }, [busyJoin, club, load])

  const sortedThreads = useMemo(() => {
    const q = threadQuery.trim().toLowerCase()
    const filtered = q
      ? threads.filter((t) => t.title.toLowerCase().includes(q))
      : threads
    return [...filtered].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
      return a.created_at < b.created_at ? 1 : -1
    })
  }, [threadQuery, threads])

  // Map chapter_name → unlock_date (string ISO). Threads with a gate
  // whose unlock_date is in the future are locked.
  const scheduleByGate = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of schedule) m.set(r.chapter_name, r.unlock_date)
    return m
  }, [schedule])

  // Earliest future unlock, drives the "Next chapter unlocks in Xd Yh" header.
  const nextUnlock = useMemo(() => {
    const now = Date.now()
    let soonest: number | null = null
    for (const r of schedule) {
      const t = new Date(r.unlock_date).getTime()
      if (Number.isFinite(t) && t > now && (soonest === null || t < soonest)) soonest = t
    }
    return soonest
  }, [schedule])

  const isLocked = useCallback(
    (t: ClubThread) => {
      if (!t.chapter_name) return false
      const unlockIso = scheduleByGate.get(t.chapter_name)
      if (!unlockIso) return false
      return new Date(unlockIso).getTime() > Date.now()
    },
    [scheduleByGate],
  )

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }

  if (!club) {
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
                bookId: club.current_book?.id ?? '',
                bookTitle: club.current_book?.title ?? '',
                author: club.current_book?.author ?? '',
                coverUrl: club.current_book?.cover_url ?? '',
                memberCount: String(club.member_count),
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
          club={club}
          role={role}
          viewerId={viewerId}
          busyJoin={busyJoin}
          waitlistPosition={waitlistPosition}
          onJoin={handleJoin}
          onLeave={handleLeave}
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
            canPost={!!role}
            query={threadQuery}
            setQuery={setThreadQuery}
            nextUnlock={nextUnlock}
            isLocked={isLocked}
            onAiStarter={() => setStarterOpen(true)}
            onNewThread={() => setNewThreadOpen(true)}
            onOpen={(t) => {
              if (isLocked(t)) return
              router.push(`/clubs/${club.id}/thread/${t.id}` as never)
            }}
          />
        ) : tab === 'reading' ? (
          <ReadingTab
            club={club}
            schedule={schedule}
            canModerate={role === 'admin' || role === 'moderator'}
            onOpenBook={(bookId) => router.push(`/book/${bookId}` as never)}
          />
        ) : tab === 'members' ? (
          <MembersTab
            members={members}
            onOpenMember={(uid) => router.push(`/user/${uid}` as never)}
          />
        ) : (
          <AboutTab club={club} stats={stats} />
        )}
      </ScrollView>

      <DiscussionStarterSheet
        visible={starterOpen}
        clubId={club.id}
        clubName={club.name}
        bookTitle={club.current_book?.title ?? null}
        author={club.current_book?.author ?? null}
        currentChapter={club.current_chapter}
        bookId={club.current_book?.id ?? null}
        onClose={() => setStarterOpen(false)}
        onPosted={(threadId) => {
          setStarterOpen(false)
          load()
          router.push(`/clubs/${club.id}/thread/${threadId}` as never)
        }}
      />

      <NewThreadSheet
        visible={newThreadOpen}
        clubId={club.id}
        defaultChapter={club.current_chapter ?? ''}
        onClose={() => setNewThreadOpen(false)}
        onPosted={(threadId) => {
          setNewThreadOpen(false)
          load()
          router.push(`/clubs/${club.id}/thread/${threadId}` as never)
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

