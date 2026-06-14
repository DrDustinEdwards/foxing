import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
  TextInput as RNTextInput,
  Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import {
  CaretLeft,
  CaretRight,
  Sparkle,
  ChatCircle,
  BookOpen,
  UsersThree,
  Info,
  Plus,
  X as XIcon,
  PushPin,
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
  PACE_OPTIONS,
  createThread,
  fetchClub,
  fetchMembers,
  fetchThreads,
  getClubSchedule,
  getClubStats,
  getWaitlistPosition,
  isMember,
  joinClub,
  joinWaitlist,
  leaveClub,
} from '@/lib/clubs'
import { DiscussionStarterSheet } from '@/components/clubs/discussion-starter-sheet'
import { MeetingsPollsSection } from '@/components/clubs/meetings-polls-section'
import { ClubLibrarySection } from '@/components/clubs/club-library-section'

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
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return a.created_at < b.created_at ? 1 : -1
    })
  }, [threadQuery, threads])

  // Map chapter_gate → unlock_date (string ISO). Threads with a gate
  // whose unlock_date is in the future are locked.
  const scheduleByGate = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of schedule) m.set(r.chapter_gate, r.unlock_date)
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
      if (!t.chapter_gate) return false
      const unlockIso = scheduleByGate.get(t.chapter_gate)
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
        {role ? (
          <Pressable
            onPress={handleLeave}
            disabled={busyJoin}
            className="px-3 py-1 rounded-full border"
            style={{ borderColor: colors.borderInteractive }}
          >
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textPrimary }}>
              {busyJoin ? '…' : role === 'admin' ? 'Owner' : 'Leave'}
            </Text>
          </Pressable>
        ) : (
          (() => {
            const isFull =
              !!club &&
              typeof club.max_members === 'number' &&
              club.max_members > 0 &&
              club.member_count >= club.max_members
            const onWaitlist = waitlistPosition !== null
            const label = busyJoin
              ? '…'
              : onWaitlist
                ? `Waitlist #${waitlistPosition}`
                : isFull
                  ? 'Join Waitlist'
                  : 'Join'
            return (
              <Pressable
                onPress={handleJoin}
                disabled={busyJoin || !viewerId || onWaitlist}
                className="px-3 py-1 rounded-full"
                style={{
                  backgroundColor: onWaitlist ? colors.bgSelected : colors.brandUi,
                  borderWidth: onWaitlist ? 1 : 0,
                  borderColor: onWaitlist ? colors.borderBrand : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 12,
                    color: onWaitlist ? colors.brandText : colors.textOnBrand,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })()
        )}
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

function DiscussionsTab({
  club,
  threads,
  canPost,
  query,
  setQuery,
  nextUnlock,
  isLocked,
  onAiStarter,
  onNewThread,
  onOpen,
}: {
  club: ClubWithBook
  threads: ClubThread[]
  canPost: boolean
  query: string
  setQuery: (q: string) => void
  nextUnlock: number | null
  isLocked: (t: ClubThread) => boolean
  onAiStarter: () => void
  onNewThread: () => void
  onOpen: (t: ClubThread) => void
}) {
  const colors = useColors()
  const countdown = useMemo(() => {
    if (!nextUnlock) return null
    const ms = nextUnlock - Date.now()
    const d = Math.floor(ms / 86_400_000)
    const h = Math.floor((ms % 86_400_000) / 3_600_000)
    return `${d}d ${h}h`
  }, [nextUnlock])
  return (
    <View>
      {countdown ? (
        <View
          className="p-3 mb-3 rounded-xl"
          style={{ backgroundColor: colors.brandSubtle }}
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 12,
              color: colors.brandSubtleText,
            }}
          >
            Next chapter unlocks in {countdown}
          </Text>
        </View>
      ) : null}
      <View className="mb-3">
        <RNTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search discussions"
          placeholderTextColor={colors.textTertiary}
          style={{
            fontFamily: Fonts.body,
            fontSize: 13,
            color: colors.textPrimary,
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        />
      </View>
      {canPost ? (
        <View className="flex-row gap-2 mb-4">
          <Pressable
            onPress={onAiStarter}
            disabled={!club.current_book}
            className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl"
            style={{ backgroundColor: club.current_book ? colors.brandUi : colors.bgDisabled }}
          >
            <Sparkle color={colors.textOnBrand} size={16} weight="regular" />
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textOnBrand }}>
              AI Starter
            </Text>
          </Pressable>
          <Pressable
            onPress={onNewThread}
            className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border"
            style={{ borderColor: colors.borderInteractive }}
          >
            <Plus color={colors.textPrimary} size={14} weight="bold" />
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
              New thread
            </Text>
          </Pressable>
        </View>
      ) : null}

      {threads.length === 0 ? (
        <View style={{ paddingVertical: 48, alignItems: 'center' }}>
          <ChatCircle color={colors.textTertiary} size={32} weight="regular" />
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textTertiary,
              textAlign: 'center',
              marginTop: 12,
              paddingHorizontal: 24,
            }}
          >
            No discussions yet. Use the AI starter or kick things off with a question.
          </Text>
        </View>
      ) : (
        threads.map((t) => {
          const locked = isLocked(t)
          return (
          <Pressable
            key={t.id}
            onPress={() => onOpen(t)}
            disabled={locked}
            className="flex-row items-center p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            style={{ opacity: locked ? 0.55 : 1 }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View className="flex-row items-center gap-1">
                {locked ? <Text style={{ fontSize: 12 }}>🔒</Text> : null}
                {t.pinned ? <PushPin color={colors.textTertiary} size={12} weight="fill" /> : null}
                {t.is_starter ? (
                  <Sparkle color={colors.brandUi} size={12} weight="regular" />
                ) : null}
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 15,
                    color: colors.textPrimary,
                  }}
                  numberOfLines={2}
                >
                  {t.title}
                </Text>
              </View>
              {t.chapter ? (
                <Text
                  style={{
                    fontFamily: Fonts.ui,
                    fontSize: 11,
                    color: colors.textTertiary,
                    marginTop: 4,
                  }}
                  numberOfLines={1}
                >
                  {t.chapter}
                </Text>
              ) : null}
              <Text
                style={{
                  fontFamily: Fonts.mono,
                  fontSize: 11,
                  color: colors.textTertiary,
                  marginTop: 4,
                }}
              >
                {t.post_count} {t.post_count === 1 ? 'post' : 'posts'}
              </Text>
            </View>
            <CaretRight color={colors.textTertiary} size={14} />
          </Pressable>
          )
        })
      )}
    </View>
  )
}

function ReadingTab({
  club,
  schedule,
  canModerate,
  onOpenBook,
}: {
  club: ClubWithBook
  schedule: ClubScheduleRow[]
  canModerate: boolean
  onOpenBook: (bookId: string) => void
}) {
  const colors = useColors()
  const pace = PACE_OPTIONS.find((p) => p.id === club.pace)
  const now = Date.now()
  const scheduleSorted = useMemo(
    () =>
      [...schedule].sort(
        (a, b) =>
          new Date(a.unlock_date).getTime() - new Date(b.unlock_date).getTime(),
      ),
    [schedule],
  )
  return (
    <View>
      {club.current_book ? (
        <Pressable
          onPress={() => onOpenBook(club.current_book!.id)}
          className="flex-row p-3 mb-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          <View
            style={{
              width: 72,
              height: 108,
              borderRadius: 6,
              overflow: 'hidden',
              backgroundColor: colors.bgSunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {club.current_book.cover_url ? (
              <Image
                source={{ uri: club.current_book.cover_url }}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <BookOpen color={colors.textTertiary} size={22} />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 16, color: colors.textPrimary }}
              numberOfLines={2}
            >
              {club.current_book.title}
            </Text>
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 12,
                color: colors.textTertiary,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {club.current_book.author}
            </Text>
            {club.current_chapter ? (
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 12,
                  color: colors.brandText,
                  marginTop: 6,
                }}
              >
                Up to: {club.current_chapter}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ) : (
        <View
          className="p-4 mb-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
            No book selected yet
          </Text>
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 13,
              color: colors.textTertiary,
              marginTop: 4,
              lineHeight: 19,
            }}
          >
            The owner can set a current book, it'll show here with a "reading up to" marker.
          </Text>
        </View>
      )}

      <View
        className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Pace
        </Text>
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary, marginTop: 6 }}>
          {pace?.label ?? club.pace}
        </Text>
        <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
          {pace?.subtitle ?? ''}
        </Text>
      </View>

      <View
        className="p-4 mt-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 12,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          Reading schedule
        </Text>
        {scheduleSorted.length === 0 ? (
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 13,
              color: colors.textTertiary,
              marginTop: 6,
            }}
          >
            No schedule set yet.
          </Text>
        ) : (
          <View style={{ marginTop: 8 }}>
            {scheduleSorted.map((s) => {
              const ts = new Date(s.unlock_date).getTime()
              const isToday =
                new Date(s.unlock_date).toDateString() ===
                new Date().toDateString()
              const status = isToday ? 'Today' : ts > now ? 'Upcoming' : 'Unlocked'
              const statusColor =
                status === 'Today'
                  ? colors.brandText
                  : status === 'Upcoming'
                    ? colors.textTertiary
                    : colors.info
              return (
                <View
                  key={`${s.chapter_gate}-${s.unlock_date}`}
                  className="flex-row items-center justify-between"
                  style={{ paddingVertical: 8 }}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 14,
                        color: colors.textPrimary,
                      }}
                    >
                      {s.chapter_gate}
                    </Text>
                    <Text
                      style={{
                        fontFamily: Fonts.ui,
                        fontSize: 12,
                        color: colors.textTertiary,
                        marginTop: 2,
                      }}
                    >
                      {new Date(s.unlock_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 11,
                      color: statusColor,
                    }}
                  >
                    {status}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </View>

      <MeetingsPollsSection clubId={club.id} canModerate={canModerate} />
      <ClubLibrarySection clubId={club.id} />
    </View>
  )
}

function MembersTab({
  members,
  onOpenMember,
}: {
  members: ClubMember[]
  onOpenMember: (id: string) => void
}) {
  const colors = useColors()
  if (members.length === 0) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>
          No members yet.
        </Text>
      </View>
    )
  }
  return (
    <View>
      {members.map((m) => {
        const name = m.profile?.display_name ?? m.profile?.username ?? 'Reader'
        const initial = (name || '?')[0]?.toUpperCase() ?? '?'
        return (
          <Pressable
            key={`${m.club_id}:${m.user_id}`}
            onPress={() => onOpenMember(m.user_id)}
            className="flex-row items-center p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                overflow: 'hidden',
                backgroundColor: colors.brandSubtle,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              {m.profile?.avatar_url ? (
                <Image
                  source={{ uri: m.profile.avatar_url }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Text
                  style={{
                    fontFamily: Fonts.display,
                    fontSize: 16,
                    color: colors.brandSubtleText,
                  }}
                >
                  {initial}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
                numberOfLines={1}
              >
                {name}
              </Text>
              <Text
                style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.textTertiary }}
                numberOfLines={1}
              >
                @{m.profile?.username ?? 'reader'} · {m.role}
              </Text>
            </View>
            <CaretRight color={colors.textTertiary} size={14} />
          </Pressable>
        )
      })}
    </View>
  )
}

function AboutTab({ club, stats }: { club: ClubWithBook; stats: ClubStats | null }) {
  const colors = useColors()
  return (
    <View>
      {club.description ? (
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 15,
            color: colors.textPrimary,
            lineHeight: 22,
            marginBottom: 16,
          }}
        >
          {club.description}
        </Text>
      ) : (
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 14,
            color: colors.textTertiary,
            marginBottom: 16,
          }}
        >
          No description yet.
        </Text>
      )}

      {stats ? (
        <View
          className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          style={{ marginBottom: 16 }}
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 10,
            }}
          >
            Club stats
          </Text>
          <View className="flex-row" style={{ gap: 14 }}>
            <StatPill value={stats.members} label="members" />
            <StatPill value={stats.threads} label="discussions" />
            <StatPill value={stats.posts} label="posts" />
          </View>
          {stats.mostActive ? (
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 12,
                color: colors.textTertiary,
                marginTop: 10,
              }}
            >
              Most active:{' '}
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary }}>
                {stats.mostActive.display_name ?? stats.mostActive.username ?? 'Reader'}
              </Text>{' '}
              ({stats.mostActive.count} posts)
            </Text>
          ) : null}
        </View>
      ) : null}

      <Row label="Visibility" value={club.is_public ? 'Public' : 'Invite-only'} />
      <Row label="Members" value={`${club.member_count}`} />
      <Row label="Pace" value={club.pace} />
      <Row label="Created" value={new Date(club.created_at).toLocaleDateString()} />
    </View>
  )
}

function StatPill({ value, label }: { value: number; label: string }) {
  const colors = useColors()
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontFamily: Fonts.displayBold, fontSize: 18, color: colors.textPrimary }}>
        {value}
      </Text>
      <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const colors = useColors()
  return (
    <View
      className="flex-row items-center justify-between py-3 border-b border-border-subtle-light dark:border-border-subtle-dark"
    >
      <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>
        {label}
      </Text>
      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
        {value}
      </Text>
    </View>
  )
}

// ── New thread sheet (manual non-AI flow) ───────────────────────────────

function NewThreadSheet({
  visible,
  clubId,
  defaultChapter,
  onClose,
  onPosted,
}: {
  visible: boolean
  clubId: string
  defaultChapter: string
  onClose: () => void
  onPosted: (threadId: string) => void
}) {
  const colors = useColors()
  const [title, setTitle] = useState('')
  const [opening, setOpening] = useState('')
  const [chapter, setChapter] = useState(defaultChapter)
  const [hasSpoilers, setHasSpoilers] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (visible) {
      setTitle('')
      setOpening('')
      setChapter(defaultChapter)
      setHasSpoilers(false)
      setBusy(false)
    }
  }, [visible, defaultChapter])

  const post = useCallback(async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    const t = await createThread({
      clubId,
      title: title.trim(),
      chapter: chapter.trim() || null,
      openingPost: opening.trim() || undefined,
      hasSpoilers,
    })
    setBusy(false)
    if (t) onPosted(t.id)
  }, [busy, chapter, clubId, hasSpoilers, onPosted, opening, title])

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      header={
        <View className="flex-row items-center justify-between px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
            <XIcon color={colors.textPrimary} size={20} />
          </Pressable>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}>
            New thread
          </Text>
          <View style={{ width: 36 }} />
        </View>
      }
      footer={
        <View className="flex-row items-center justify-end">
          <Pressable
            onPress={post}
            disabled={!title.trim() || busy}
            className="px-5 py-2 rounded-full"
            style={{
              backgroundColor: title.trim() ? colors.brandUi : colors.bgDisabled,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.textOnBrand} size="small" />
            ) : (
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                Post
              </Text>
            )}
          </Pressable>
        </View>
      }
    >
            <Text style={fieldLabelStyle(colors)}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What do you want to discuss?"
              placeholderTextColor={colors.textTertiary}
              maxLength={120}
              style={inputStyle(colors)}
            />
            <Text style={fieldLabelStyle(colors)}>Chapter (optional)</Text>
            <TextInput
              value={chapter}
              onChangeText={setChapter}
              placeholder="Chapter or section"
              placeholderTextColor={colors.textTertiary}
              maxLength={120}
              style={inputStyle(colors)}
            />
            <Text style={fieldLabelStyle(colors)}>Opening post (optional)</Text>
            <TextInput
              value={opening}
              onChangeText={setOpening}
              placeholder="Set the scene for the discussion…"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={{ ...inputStyle(colors), height: 160, textAlignVertical: 'top' }}
            />
            <View
              className="flex-row items-center justify-between mt-3 p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
                Mark as containing spoilers
              </Text>
              <Switch
                value={hasSpoilers}
                onValueChange={setHasSpoilers}
                trackColor={{ false: colors.bgDisabled, true: colors.toggleOn }}
              />
            </View>
    </SheetScaffold>
  )
}

function fieldLabelStyle(colors: ReturnType<typeof useColors>) {
  return {
    fontFamily: Fonts.uiMedium,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  }
}

function inputStyle(colors: ReturnType<typeof useColors>) {
  return {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as const
}
