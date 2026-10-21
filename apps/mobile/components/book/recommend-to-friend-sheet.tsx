import { useColors } from '@/constants/colors'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'
import { NoteInput } from '@/components/book/book-detail-parts'

export function RecommendToFriendSheet({
  visible,
  onClose,
  bookId,
  bookTitle,
}: {
  visible: boolean
  onClose: () => void
  bookId: string
  bookTitle: string
}) {
  const colors = useColors()
  const [followed, setFollowed] = useState<
    Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }>
  >([])
  const [loading, setLoading] = useState(true)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [viewerName, setViewerName] = useState<string>('')

  useEffect(() => {
    if (!visible) return
    let cancel = false
    setLoading(true)
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancel) setLoading(false)
        return
      }
      const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .maybeSingle()
      const viewer = viewerProfile as { display_name: string | null; username: string | null } | null
      if (!cancel) {
        setViewerName(viewer?.display_name ?? viewer?.username ?? 'A friend')
      }

      const { data } = await supabase
        .from('follows')
        .select('following:profiles!following_id(id, display_name, username, avatar_url)')
        .eq('follower_id', user.id)
        .limit(100)
      if (cancel) return
      type F = {
        following:
          | { id: string; display_name: string | null; username: string | null; avatar_url: string | null }
          | Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }>
          | null
      }
      const rows: Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }> = []
      for (const r of ((data ?? []) as unknown) as F[]) {
        const f = Array.isArray(r.following) ? r.following[0] : r.following
        if (f) rows.push(f)
      }
      rows.sort((a, b) => (a.display_name ?? a.username ?? '').localeCompare(b.display_name ?? b.username ?? ''))
      setFollowed(rows)
      setLoading(false)
    })()
    return () => {
      cancel = true
    }
  }, [visible])

  const recommend = useCallback(
    async (targetId: string) => {
      setSent((prev) => new Set(prev).add(targetId))
      // Best-effort notification + optional record. Notifications table
      // exists; a dedicated recommendations table is optional.
      const { createNotification } = await import('@/lib/notifications')
      await createNotification(
        targetId,
        'book_recommendation',
        `${viewerName} recommends ${bookTitle}`,
        note.trim() || null,
        { book_id: bookId, recommender_note: note.trim() || null },
      )
      try {
        await supabase.from('book_recommendations').insert({
          book_id: bookId,
          recommended_to: targetId,
          note: note.trim() || null,
        })
      } catch {
        /* recommendations table optional */
      }
    },
    [bookId, bookTitle, note, viewerName],
  )

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      scroll={false}
      maxHeight="80%"
      header={
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 12,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            paddingHorizontal: 20,
            marginBottom: 8,
          }}
        >
          Recommend to a friend
        </Text>
      }
    >
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <Text
              style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textSecondary }}
              numberOfLines={1}
            >
              {bookTitle}
            </Text>
          </View>
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <NoteInput value={note} onChangeText={setNote} />
          </View>
          {loading ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <ActivityIndicator color={colors.brandUi} />
            </View>
          ) : followed.length === 0 ? (
            <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
              <Text
                style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textTertiary }}
              >
                Follow some readers to share books with them.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 360 }}>
              {followed.map((f) => {
                const name = f.display_name ?? f.username ?? 'Reader'
                const handle = f.username ? `@${f.username}` : ''
                const wasSent = sent.has(f.id)
                return (
                  <View
                    key={f.id}
                    className="flex-row items-center px-5"
                    style={{ minHeight: 56 }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: colors.brandSubtle,
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        marginRight: 12,
                      }}
                    >
                      {f.avatar_url ? (
                        <Image
                          source={{ uri: f.avatar_url }}
                          style={{ width: '100%', height: '100%' }}
                        />
                      ) : (
                        <Text
                          style={{
                            fontFamily: Fonts.uiMedium,
                            fontSize: 14,
                            color: colors.brandSubtleText,
                          }}
                        >
                          {(name[0] ?? '?').toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: Fonts.uiMedium,
                          fontSize: 14,
                          color: colors.textPrimary,
                        }}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                      {handle ? (
                        <Text
                          style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}
                          numberOfLines={1}
                        >
                          {handle}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => !wasSent && recommend(f.id)}
                      disabled={wasSent}
                      className="px-3 py-2 rounded-full"
                      style={{
                        backgroundColor: wasSent ? colors.bgSelected : colors.brandUi,
                        opacity: wasSent ? 0.7 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: Fonts.uiMedium,
                          fontSize: 12,
                          color: wasSent ? colors.brandText : colors.textOnBrand,
                        }}
                      >
                        {wasSent ? 'Sent' : 'Send'}
                      </Text>
                    </Pressable>
                  </View>
                )
              })}
            </ScrollView>
          )}
    </SheetScaffold>
  )
}
