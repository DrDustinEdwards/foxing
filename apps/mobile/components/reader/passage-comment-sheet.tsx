import { newId, useBookAnnotations, useMe, usePassageComment } from '@foxing/client'
import type * as W from '@foxing/types'
import { useCallback, useEffect, useState } from 'react'
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
import { decodeLocator, encodeLocator } from './readium-helpers'
import { PassageCommentComposer } from './passage-comment-composer'
import { PassageCommentList } from './passage-comment-list'

interface PassageCommentSheetProps {
  visible: boolean
  bookId: string
  cfi: string | null
  passageText: string
  /** The viewer's clubs reading this book; a comment goes to one of them. */
  clubs: { id: string; name: string }[]
  onClose: () => void
}

// The club discussion on one passage: the comments anchored there (from the book's
// annotation layers), their replies, and a composer. A new comment shows at once.
export function PassageCommentSheet({
  visible,
  bookId,
  cfi,
  passageText,
  clubs,
  onClose,
}: PassageCommentSheetProps) {
  const colors = useColors()
  const layers = useBookAnnotations(bookId)
  const me = useMe()
  const post = usePassageComment()
  const [body, setBody] = useState('')
  const [hasSpoilers, setHasSpoilers] = useState(false)
  const [replyTo, setReplyTo] = useState<W.ResolvedComment | null>(null)
  // Spoiler reveal is per comment, keyed by id.
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [activeClubId, setActiveClubId] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setBody('')
      setHasSpoilers(false)
      setReplyTo(null)
      setRevealed(new Set())
      setActiveClubId(clubs[0]?.id ?? null)
    }
  }, [visible, clubs])

  const all = layers.data?.comments ?? []
  const comments = all.filter((c) => !c.parentId && c.locator && encodeLocator(c.locator) === cfi)
  const replies = all.filter((c) => c.parentId && comments.some((p) => p.id === c.parentId))

  const toggleReveal = useCallback((key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const profile = me.data?.profile
  const send = useCallback(() => {
    const text = body.trim()
    const clubId = replyTo?.clubId ?? activeClubId
    if (!text || !clubId || !cfi || !profile) return
    post.fire({
      id: newId(),
      clubId,
      bookId,
      body: text,
      ...(replyTo ? { parentId: replyTo.id } : { locator: (decodeLocator(cfi) as unknown as W.Locator | undefined) ?? null }),
      containsSpoilers: hasSpoilers,
      you: {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
    })
    setBody('')
    setReplyTo(null)
    setHasSpoilers(false)
  }, [activeClubId, body, bookId, cfi, hasSpoilers, post, profile, replyTo])

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
          posting={post.pending}
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
              const active = c.id === activeClubId
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setActiveClubId(c.id)}
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
            {post.error ? (
              <Text accessibilityRole="alert" style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.error, marginBottom: 8 }}>
                {post.error}
              </Text>
            ) : null}
            <PassageCommentList
              loading={layers.isPending}
              comments={comments}
              replies={replies}
              revealed={revealed}
              onToggleReveal={toggleReveal}
              onReply={setReplyTo}
            />
    </SheetScaffold>
  )
}

