import type * as W from '@foxing/types'
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
import { MeetingsPollsSection } from '@/components/clubs/meetings-polls-section'
import { relativeTime } from '@/lib/relative-time'

const PACE_LABELS: Record<string, string> = {
  chill: 'Chill, a chapter a week, no pressure.',
  steady: 'Steady, two-to-three chapters a week.',
  fast: 'Fast, daily reading.',
}

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
  club: W.ClubInfo
  threads: W.ClubThreadItem[]
  canPost: boolean
  query: string
  setQuery: (q: string) => void
  nextUnlock: number | null
  isLocked: (t: W.ClubThreadItem) => boolean
  onAiStarter: () => void
  onNewThread: () => void
  onOpen: (t: W.ClubThreadItem) => void
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
            disabled={!club.currentBook}
            className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl"
            style={{ backgroundColor: club.currentBook ? colors.brandUi : colors.bgDisabled }}
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
                {t.isPinned ? <PushPin color={colors.textTertiary} size={12} weight="fill" /> : null}
                {t.isAiStarter ? (
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
                {t.author ? `${t.author.displayName ?? t.author.username} · ` : ''}
                {relativeTime(t.createdAt)}
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
  page,
  signedIn,
  onOpenBook,
}: {
  page: W.ClubPage
  signedIn: boolean
  onOpenBook: (slug: string) => void
}) {
  const colors = useColors()
  const club = page.club
  const now = Date.now()
  const scheduleSorted = useMemo(
    () => [...page.schedule].sort((a, b) => a.unlockDate - b.unlockDate),
    [page.schedule],
  )
  return (
    <View>
      {club.currentBook ? (
        <Pressable
          onPress={() => club.currentBook && onOpenBook(club.currentBook.slug)}
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
            {club.currentBook.coverUrl ? (
              <Image
                source={{ uri: club.currentBook.coverUrl }}
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
              {club.currentBook.title}
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
              {club.currentBook.author}
            </Text>
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
          {PACE_LABELS[club.readingPace ?? ''] ?? club.readingPace ?? 'Set by the club'}
        </Text>
        {club.chaptersPerWeek ? (
          <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
            {club.chaptersPerWeek} chapter{club.chaptersPerWeek === 1 ? '' : 's'} a week
          </Text>
        ) : null}
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
              const ts = s.unlockDate
              const isToday = new Date(ts).toDateString() === new Date().toDateString()
              const status = isToday ? 'Today' : ts > now ? 'Upcoming' : 'Unlocked'
              const statusColor =
                status === 'Today'
                  ? colors.brandText
                  : status === 'Upcoming'
                    ? colors.textTertiary
                    : colors.info
              return (
                <View
                  key={s.id}
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
                      {s.chapterName}
                    </Text>
                    <Text
                      style={{
                        fontFamily: Fonts.ui,
                        fontSize: 12,
                        color: colors.textTertiary,
                        marginTop: 2,
                      }}
                    >
                      {new Date(s.unlockDate).toLocaleDateString()}
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

      <MeetingsPollsSection page={page} signedIn={signedIn} />
    </View>
  )
}

export function MembersTab({
  members,
  onOpenMember,
}: {
  members: W.ClubMemberItem[]
  onOpenMember: (username: string) => void
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
        const name = m.profile?.displayName ?? m.profile?.username ?? 'Reader'
        const initial = (name || '?')[0]?.toUpperCase() ?? '?'
        return (
          <Pressable
            key={m.userId}
            onPress={() => m.profile && onOpenMember(m.profile.username)}
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
              {m.profile?.avatarUrl ? (
                <Image
                  source={{ uri: m.profile.avatarUrl }}
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

export function AboutTab({ club, threadCount }: { club: W.ClubInfo; threadCount: number }) {
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

      <Row label="Visibility" value={club.visibility === 'public' ? 'Public' : 'Invite-only'} />
      <Row label="Members" value={`${club.memberCount}`} />
      <Row label="Discussions" value={`${threadCount}`} />
      {club.readingPace ? <Row label="Pace" value={club.readingPace} /> : null}
      {club.genreTags.length > 0 ? <Row label="Genres" value={club.genreTags.join(', ')} /> : null}
      <Row label="Created" value={new Date(club.createdAt).toLocaleDateString()} />
      {club.joinCode ? <Row label="Invite code" value={club.joinCode} /> : null}
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
