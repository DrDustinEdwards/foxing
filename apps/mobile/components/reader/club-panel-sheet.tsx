import { useBookAnnotations, useClubLive, useClubPage } from '@foxing/client'
import type * as W from '@foxing/types'
import { useEffect, useMemo, useState } from 'react'
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

// Half-height bottom-anchored panel that slides up over the bottom of
// the reader. Unlike the rest of the reader sheets this is NOT a Modal,
// so the canvas above keeps receiving taps and swipes while the panel
// is open -- per spec, "reading continues" while it sits on top.
//
// Two tabs:
//   - Discussion: this club's passage comments on the book, from the book's
//     annotation layers. Tap one to open its PassageCommentSheet.
//   - Members: the club's members, marked when they are in the club right now
//     (the club's live socket).

interface ClubPanelSheetProps {
  visible: boolean
  club: { id: string; name: string }
  bookId: string
  bookTitle: string
  onOpenComment: (comment: W.ResolvedComment) => void
  onClose: () => void
}

type Tab = 'discussion' | 'members'

export function ClubPanelSheet({
  visible,
  club,
  bookId,
  bookTitle,
  onOpenComment,
  onClose,
}: ClubPanelSheetProps) {
  const colors = useColors()
  const { height: screenHeight } = useWindowDimensions()
  const panelHeight = Math.round(screenHeight * 0.55)

  const [tab, setTab] = useState<Tab>('discussion')
  const layers = useBookAnnotations(bookId)
  const page = useClubPage(club.id)
  const live = useClubLive(visible ? club.id : null)
  const comments = (layers.data?.comments ?? [])
    .filter((c) => c.clubId === club.id && !c.parentId)
    .sort((a, b) => b.createdAt - a.createdAt)
  const members = (page.data?.members ?? []).filter((m) => m.status === 'active')
  const loading = tab === 'discussion' ? layers.isPending : page.isPending

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
            <MembersList members={members} online={new Set(live.presence)} />
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
  comments: W.ResolvedComment[]
  onOpenComment: (c: W.ResolvedComment) => void
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
          {c.chapter ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: Fonts.bodyItalic,
                fontSize: 12,
                color: colors.textTertiary,
                lineHeight: 17,
                marginBottom: 6,
              }}
            >
              {c.chapter}
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
            {c.gate.spoiler || c.gate.ahead ? 'Hidden for now, tap to read' : c.body}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

function MembersList({ members, online }: { members: W.ClubMemberItem[]; online: Set<string> }) {
  const colors = useColors()
  if (members.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>No members yet.</Text>
      </View>
    )
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
      {members.map((m) => {
        const name = m.profile?.displayName ?? m.profile?.username ?? 'Reader'
        const initial = (name || '?')[0]?.toUpperCase() ?? '?'
        const here = online.has(m.userId)
        return (
          <View
            key={m.userId}
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
              {m.profile?.avatarUrl ? (
                <Image source={{ uri: m.profile.avatarUrl }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={{ fontFamily: Fonts.display, fontSize: 15, color: colors.brandSubtleText }}>
                  {initial}
                </Text>
              )}
            </View>
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}
            >
              {name}
            </Text>
            {here ? (
              <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.brandText }}>Here now</Text>
            ) : null}
          </View>
        )
      })}
    </ScrollView>
  )
}
