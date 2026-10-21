import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { pickOne, supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/feed'

interface ClubBookRow {
  id: string
  started_at: string | null
  finished_at: string | null
  is_current: boolean | null
  book: {
    id: string
    title: string
    author: string
    cover_url: string | null
  } | null
}

export function ClubLibrarySection({ clubId }: { clubId: string }) {
  const colors = useColors()
  const router = useRouter()
  const [rows, setRows] = useState<ClubBookRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('club_books')
      .select(
        'id, started_at, finished_at, is_current, book:book_id(id, title, author, cover_url)',
      )
      .eq('club_id', clubId)
      .order('started_at', { ascending: false })
    const raw = ((data ?? []) as unknown) as Array<Record<string, unknown>>
    setRows(
      raw.map((r) => ({
        id: String(r.id),
        started_at: (r.started_at as string | null) ?? null,
        finished_at: (r.finished_at as string | null) ?? null,
        is_current: (r.is_current as boolean | null) ?? null,
        book: pickOne<{
          id: string
          title: string
          author: string
          cover_url: string | null
        }>(r.book),
      })),
    )
    setLoading(false)
  }, [clubId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <View style={{ paddingVertical: 12 }}>
        <ActivityIndicator color={colors.brandUi} />
      </View>
    )
  }

  if (rows.length === 0) return null

  return (
    <View style={{ marginTop: 16 }}>
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
        Library
      </Text>
      {rows.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => {
            if (r.book?.id) router.push(`/book/${r.book.id}` as never)
          }}
          className="flex-row p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          <View
            style={{
              width: 48,
              height: 72,
              borderRadius: 4,
              overflow: 'hidden',
              backgroundColor: colors.bgSunken,
            }}
          >
            {r.book?.cover_url ? (
              <Image
                source={{ uri: r.book.cover_url }}
                style={{ width: '100%', height: '100%' }}
              />
            ) : null}
          </View>
          <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 14,
                color: colors.textPrimary,
              }}
              numberOfLines={2}
            >
              {r.book?.title ?? 'Unknown'}
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
              {r.book?.author ?? ''}
            </Text>
            <View
              className="flex-row items-center"
              style={{ gap: 6, marginTop: 6 }}
            >
              {r.is_current ? (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: colors.brandSubtle,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.mono,
                      fontSize: 10,
                      color: colors.brandSubtleText,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    Currently reading
                  </Text>
                </View>
              ) : null}
              {r.finished_at ? (
                <Text
                  style={{
                    fontFamily: Fonts.mono,
                    fontSize: 11,
                    color: colors.textTertiary,
                  }}
                >
                  Finished {relativeTime(r.finished_at)}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  )
}
