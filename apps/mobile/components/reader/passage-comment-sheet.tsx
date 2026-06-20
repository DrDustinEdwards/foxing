import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
} from 'react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import {
  X as XIcon,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  type PassageComment,
  createComment,
  createReply,
  listCommentsAtCfi,
  toggleCommentReaction,
} from '@/lib/passage-comments'
import { PassageCommentComposer } from './passage-comment-composer'
import { PassageCommentList } from './passage-comment-list'

interface ClubChoice {
  club_id: string
  name: string
}

interface PassageCommentSheetProps {
  visible: boolean
  bookId: string
  cfi: string | null
  passageText: string
  clubs: ClubChoice[]
  // The club the new comment will be written to. Defaults to first in `clubs`.
  // Reader screen sets this so the sheet doesn't need its own club picker
  // when the viewer is in just one matching club.
  defaultClubId?: string | null
  onClose: () => void
}

export function PassageCommentSheet({
  visible,
  bookId,
  cfi,
  passageText,
  clubs,
  defaultClubId,
  onClose,
}: PassageCommentSheetProps) {
  const colors = useColors()
  const [comments, setComments] = useState<PassageComment[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [hasSpoilers, setHasSpoilers] = useState(false)
  const [posting, setPosting] = useState(false)
  const [replyTo, setReplyTo] = useState<PassageComment | null>(null)
  // Spoiler reveal is per-comment / per-reply, keyed by id.
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  // When the viewer is in multiple matching clubs, let them pick which
  // club the new comment posts to.
  const [activeClubId, setActiveClubId] = useState<string | null>(null)

  const clubIds = useMemo(() => clubs.map((c) => c.club_id), [clubs])

  // Reset state on open. We deliberately don't reset across visible→hidden→
  // visible cycles so quickly toggling the sheet doesn't churn the list.
  useEffect(() => {
    if (visible) {
      setBody('')
      setHasSpoilers(false)
      setReplyTo(null)
      setRevealed(new Set())
      setActiveClubId(defaultClubId ?? clubs[0]?.club_id ?? null)
    }
  }, [visible, defaultClubId, clubs])

  const load = useCallback(async () => {
    if (!cfi) {
      setComments([])
      setLoading(false)
      return
    }
    setLoading(true)
    const rows = await listCommentsAtCfi({ bookId, clubIds, cfi })
    setComments(rows)
    setLoading(false)
  }, [bookId, cfi, clubIds])

  useEffect(() => {
    if (visible) load()
  }, [visible, load])

  const toggleReveal = useCallback((key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const onReact = useCallback(
    async (commentId: string, emoji: string) => {
      // Optimistic, flip reacted/count on the matching reaction group.
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId) return c
          const groups = c.reactions ?? []
          const exists = groups.find((g) => g.emoji === emoji)
          if (exists) {
            return {
              ...c,
              reactions: groups
                .map((g) =>
                  g.emoji === emoji
                    ? {
                        ...g,
                        count: g.count + (g.viewerReacted ? -1 : 1),
                        viewerReacted: !g.viewerReacted,
                      }
                    : g,
                )
                .filter((g) => g.count > 0),
            }
          }
          return {
            ...c,
            reactions: [...groups, { emoji, count: 1, viewerReacted: true }],
          }
        }),
      )
      const ok = await toggleCommentReaction(commentId, emoji)
      if (!ok) load()
    },
    [load],
  )

  const send = useCallback(async () => {
    if (!body.trim() || posting || !cfi) return
    if (replyTo) {
      // The live schema has no spoiler field on replies; hasSpoilers is
      // ignored when replying. Top-level comments still carry the flag.
      setPosting(true)
      const reply = await createReply({
        commentId: replyTo.id,
        content: body.trim(),
      })
      setPosting(false)
      if (reply) {
        setBody('')
        setReplyTo(null)
        setHasSpoilers(false)
        load()
      }
      return
    }
    if (!activeClubId) return
    setPosting(true)
    const created = await createComment({
      bookId,
      clubId: activeClubId,
      cfi,
      passageText,
      comment: body.trim(),
      visibility: 'club',
      spoilerTagged: hasSpoilers,
    })
    setPosting(false)
    if (created) {
      setBody('')
      setHasSpoilers(false)
      load()
    }
  }, [activeClubId, body, bookId, cfi, hasSpoilers, load, passageText, posting, replyTo])

  const canPost = !!activeClubId && !!cfi

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
      stickyFooter
      footer={
        <PassageCommentComposer
          body={body}
          onChangeBody={setBody}
          hasSpoilers={hasSpoilers}
          onChangeHasSpoilers={setHasSpoilers}
          posting={posting}
          canPost={canPost}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={send}
        />
      }
      header={
        <>
        <View className="flex-row items-center justify-between px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
            <XIcon color={colors.textPrimary} size={20} />
          </Pressable>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}>
            Passage discussion
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Passage quote */}
        <View
          className="mx-4 mb-2 p-3 rounded-xl"
          style={{
            backgroundColor: colors.bgSunken,
            borderLeftWidth: 3,
            borderLeftColor: colors.brandUi,
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 13,
              color: colors.textPrimary,
              lineHeight: 19,
              fontStyle: 'italic',
            }}
            numberOfLines={4}
          >
            “{passageText || 'Selected passage'}”
          </Text>
        </View>

        {/* Club selector, only when the viewer is in 2+ matching clubs */}
        {clubs.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 6 }}
          >
            {clubs.map((c) => {
              const active = c.club_id === activeClubId
              return (
                <Pressable
                  key={c.club_id}
                  onPress={() => setActiveClubId(c.club_id)}
                  className="px-3 py-1 rounded-full border"
                  style={{
                    backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                    borderColor: active ? colors.borderBrand : colors.borderSubtle,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 11,
                      color: active ? colors.brandText : colors.textSecondary,
                    }}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : null}
        </>
      }
    >
            <PassageCommentList
              loading={loading}
              comments={comments}
              revealed={revealed}
              onToggleReveal={toggleReveal}
              onReact={onReact}
              onReply={setReplyTo}
            />
    </SheetScaffold>
  )
}

