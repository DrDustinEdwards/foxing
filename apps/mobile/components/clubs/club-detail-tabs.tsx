import { useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  Image,
  TextInput as RNTextInput,
} from 'react-native'
import {
  CaretRight,
  Sparkle,
  ChatCircle,
  BookOpen,
  Plus,
  PushPin,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  type ClubMember,
  type ClubScheduleRow,
  type ClubStats,
  type ClubThread,
  type ClubWithBook,
  PACE_OPTIONS,
} from '@/lib/clubs'
import { MeetingsPollsSection } from '@/components/clubs/meetings-polls-section'
import { ClubLibrarySection } from '@/components/clubs/club-library-section'

export function DiscussionsTab({
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
                {t.is_pinned ? <PushPin color={colors.textTertiary} size={12} weight="fill" /> : null}
                {t.is_ai_starter ? (
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

export function ReadingTab({
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
                  key={`${s.chapter_name}-${s.unlock_date}`}
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
                      {s.chapter_name}
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

export function MembersTab({
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

export function AboutTab({ club, stats }: { club: ClubWithBook; stats: ClubStats | null }) {
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
