import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X as XIcon, ChatCircleDots } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { supabase } from '@/lib/supabase'
import {
  listCommentsForBook,
  type PassageComment,
} from '@/lib/passage-comments'

// Half-height bottom-anchored panel that slides up over the bottom of
// the reader. Unlike the rest of the reader sheets this is NOT a Modal,
// so the canvas above keeps receiving taps and swipes while the panel
// is open -- per spec, "reading continues" while it sits on top.
//
// Two tabs:
//   - Discussion: recent passage comments for this club + book. Tap a
//     row to open the existing PassageCommentSheet with replies +
//     reactions. ("Chapter-gated thread list" per spec is approximated
//     as a flat recent-first list because passage_comments doesn't
//     carry a chapter column -- adding that would need a schema
//     migration which is out of scope here.)
//   - Members: club members with reading progress bars. One Supabase
//     query joins club_members + profiles + user_books.

interface ClubInfo {
  club_id: string
  name: string
}

interface MemberRow {
  user_id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  progress_percentage: number | null
}

interface ClubPanelSheetProps {
  visible: boolean
  club: ClubInfo
  bookId: string
  bookTitle: string
  // Which club ids the viewer belongs to that are reading this book.
  // listCommentsForBook needs the full list so the visibility filter
  // matches what surfaces in the rest of the reader.
  viewerClubIds: string[]
  onOpenComment: (comment: PassageComment) => void
  onClose: () => void
}

type Tab = 'discussion' | 'members'

export function ClubPanelSheet({
  visible,
  club,
  bookId,
  bookTitle,
  viewerClubIds,
  onOpenComment,
  onClose,
}: ClubPanelSheetProps) {
  const colors = useColors()
  const { height: screenHeight } = useWindowDimensions()
  const panelHeight = Math.round(screenHeight * 0.55)

  const [tab, setTab] = useState<Tab>('discussion')
  const [comments, setComments] = useState<PassageComment[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(false)

  // Slide-up animation. Translate from off-screen to 0 when visible.
  const slide = useMemo(() => new Animated.Value(panelHeight), [panelHeight])
  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : panelHeight,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [visible, panelHeight, slide])

  const loadDiscussion = useCallback(async () => {
    setLoading(true)
    const rows = await listCommentsForBook(bookId, viewerClubIds)
    setComments(
      rows.filter((c) => c.club_id === null || c.club_id === club.club_id),
    )
    setLoading(false)
  }, [bookId, viewerClubIds, club.club_id])

  const loadMembers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', club.club_id)
    if (error) {
      console.warn('[club-panel] members fetch failed:', error.message)
      setMembers([])
      setLoading(false)
      return
    }
    const rows = ((data ?? []) as unknown) as Array<{ user_id: string }>
    const memberIds = rows.map((r) => r.user_id)
    if (memberIds.length === 0) {
      setMembers([])
      setLoading(false)
      return
    }
    // club_members.user_id FKs auth.users, not profiles, so member profiles are
    // fetched separately rather than embedded.
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', memberIds)
    const profileById = new Map<
      string,
      { display_name: string | null; username: string | null; avatar_url: string | null }
    >()
    for (const p of (((profileData ?? []) as unknown) as Array<{
      id: string
      display_name: string | null
      username: string | null
      avatar_url: string | null
    }>)) {
      profileById.set(p.id, {
        display_name: p.display_name,
        username: p.username,
        avatar_url: p.avatar_url,
      })
    }
    // Pull progress in a second query rather than as a nested join --
    // user_books has its own RLS that doesn't necessarily allow joined
    // reads through club_members, so we hydrate the field separately.
    const { data: progressData } = await supabase
      .from('user_books')
      .select('user_id, progress_percentage')
      .eq('book_id', bookId)
      .in('user_id', memberIds)
    const progressByUser = new Map<string, number>()
    for (const p of (progressData ?? []) as Array<{
      user_id: string
      progress_percentage: number | null
    }>) {
      if (p.progress_percentage != null) {
        progressByUser.set(p.user_id, p.progress_percentage)
      }
    }
    setMembers(
      rows.map((r) => {
        const p = profileById.get(r.user_id)
        return {
          user_id: r.user_id,
          display_name: p?.display_name ?? null,
          username: p?.username ?? null,
          avatar_url: p?.avatar_url ?? null,
          progress_percentage: progressByUser.get(r.user_id) ?? null,
        }
      }),
    )
    setLoading(false)
  }, [club.club_id, bookId])

  useEffect(() => {
    if (!visible) return
    if (tab === 'discussion') loadDiscussion()
    else loadMembers()
  }, [visible, tab, loadDiscussion, loadMembers])

  if (!visible) {
    // Keep the panel mounted only when visible so the Animated value
    // doesn't churn while the reader is uninvolved.
    return null
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: panelHeight,
        transform: [{ translateY: slide }],
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bgElevated,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTopWidth: 1,
          borderTopColor: colors.borderSubtle,
          shadowColor: colors.shadowMd,
          shadowOpacity: 1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          elevation: 12,
        }}
      >
        <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.borderSubtle,
              marginTop: 8,
            }}
          />
          <View
            className="flex-row items-center"
            style={{
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 6,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: Fonts.display,
                  fontSize: 16,
                  color: colors.textPrimary,
                }}
              >
                {club.name}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 12,
                  color: colors.textTertiary,
                  marginTop: 1,
                }}
              >
                {bookTitle}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close club panel"
              style={{ padding: 4 }}
            >
              <XIcon color={colors.textPrimary} size={20} />
            </Pressable>
          </View>

          <View
            className="flex-row"
            style={{
              paddingHorizontal: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <TabButton
              label="Discussion"
              active={tab === 'discussion'}
              onPress={() => setTab('discussion')}
            />
            <TabButton
              label="Members"
              active={tab === 'members'}
              onPress={() => setTab('members')}
            />
          </View>

          {loading ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator color={colors.brandUi} />
            </View>
          ) : tab === 'discussion' ? (
            <DiscussionList
              comments={comments}
              onOpenComment={onOpenComment}
            />
          ) : (
            <MembersList members={members} />
          )}
        </SafeAreaView>
      </View>
    </Animated.View>
  )
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const colors = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 2,
        borderBottomColor: active ? colors.brandUi : 'transparent',
        marginBottom: -1,
      }}
    >
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 13,
          color: active ? colors.brandText : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function DiscussionList({
  comments,
  onOpenComment,
}: {
  comments: PassageComment[]
  onOpenComment: (c: PassageComment) => void
}) {
  const colors = useColors()
  if (comments.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <ChatCircleDots color={colors.textTertiary} size={28} />
        <Text
          style={{
            fontFamily: Fonts.ui,
            fontSize: 13,
            color: colors.textTertiary,
            marginTop: 10,
            textAlign: 'center',
          }}
        >
          No discussion yet. Long-press a passage to start one.
        </Text>
      </View>
    )
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
      {comments.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => onOpenComment(c)}
          className="p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          {c.passage_text ? (
            <Text
              numberOfLines={2}
              style={{
                fontFamily: Fonts.bodyItalic,
                fontSize: 12,
                color: colors.textTertiary,
                lineHeight: 17,
                marginBottom: 6,
              }}
            >
              {c.passage_text}
            </Text>
          ) : null}
          <Text
            numberOfLines={2}
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textPrimary,
              lineHeight: 21,
            }}
          >
            {c.spoiler_tagged ? 'Spoiler hidden, tap to read' : c.comment}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

function MembersList({ members }: { members: MemberRow[] }) {
  const colors = useColors()
  if (members.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: Fonts.ui,
            fontSize: 13,
            color: colors.textTertiary,
          }}
        >
          No members yet.
        </Text>
      </View>
    )
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
      {members.map((m) => {
        const name = m.display_name ?? m.username ?? 'Reader'
        const initial = (name || '?')[0]?.toUpperCase() ?? '?'
        const progress = m.progress_percentage ?? 0
        return (
          <View
            key={m.user_id}
            className="flex-row items-center p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                overflow: 'hidden',
                backgroundColor: colors.brandSubtle,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              {m.avatar_url ? (
                <Image
                  source={{ uri: m.avatar_url }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Text
                  style={{
                    fontFamily: Fonts.display,
                    fontSize: 15,
                    color: colors.brandSubtleText,
                  }}
                >
                  {initial}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 13,
                  color: colors.textPrimary,
                }}
              >
                {name}
              </Text>
              <View
                style={{
                  marginTop: 6,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.borderSubtle,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
                    backgroundColor: colors.brandUi,
                  }}
                />
              </View>
            </View>
            <Text
              style={{
                fontFamily: Fonts.mono,
                fontSize: 11,
                color: colors.textTertiary,
                marginLeft: 8,
                minWidth: 36,
                textAlign: 'right',
              }}
            >
              {Math.round(progress * 100)}%
            </Text>
          </View>
        )
      })}
    </ScrollView>
  )
}
