import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { ChatCircleDots, Plus } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { relativeTime } from '@/lib/feed'

interface DiscussionRow {
  id: string
  title: string
  type: string | null
  spoiler_tagged: boolean | null
  created_at: string
  updated_at: string
  author: {
    display_name: string | null
    username: string | null
  } | null
}

interface Props {
  bookId: string
  bookSlug: string | null
}

export function BookDiscussionsSection({ bookId, bookSlug }: Props) {
  const colors = useColors()
  const router = useRouter()
  const [rows, setRows] = useState<DiscussionRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('discussions')
      .select(
        'id, title, type, spoiler_tagged, created_at, updated_at, author:author_id(display_name, username)',
      )
      .eq('book_id', bookId)
      .is('club_id', null)
      .order('updated_at', { ascending: false })
      .limit(10)
    const list = ((data ?? []) as unknown) as Array<Record<string, unknown>>
    const normalized: DiscussionRow[] = list.map((r) => {
      const author = Array.isArray(r.author)
        ? (r.author[0] as { display_name?: string | null; username?: string | null } | undefined)
        : (r.author as { display_name?: string | null; username?: string | null } | null)
      return {
        id: String(r.id),
        title: String(r.title ?? ''),
        type: (r.type as string | null) ?? null,
        spoiler_tagged: Boolean(r.spoiler_tagged),
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
        author: author
          ? {
              display_name: author.display_name ?? null,
              username: author.username ?? null,
            }
          : null,
      }
    })
    setRows(normalized)
    setLoading(false)
  }, [bookId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <View style={{ marginTop: 24 }}>
      <View className="flex-row items-center justify-between" style={{ marginBottom: 10 }}>
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          Discussions
        </Text>
        <Pressable
          onPress={() =>
            router.push(
              `/book/${bookSlug ?? bookId}/discussion/new` as never,
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Start a discussion"
          className="flex-row items-center"
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: colors.bgSurface,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            gap: 4,
          }}
        >
          <Plus color={colors.brandText} size={12} weight="bold" />
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.brandText,
            }}
          >
            New
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brandUi} />
      ) : rows.length === 0 ? (
        <View
          className="flex-row items-center p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          <ChatCircleDots color={colors.textTertiary} size={20} />
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 13,
              color: colors.textTertiary,
              marginLeft: 10,
              flex: 1,
            }}
          >
            No discussions yet. Start one.
          </Text>
        </View>
      ) : (
        <View>
          {rows.map((d) => (
            <Pressable
              key={d.id}
              onPress={() =>
                router.push(
                  `/book/${bookSlug ?? bookId}/discussion/${d.id}` as never,
                )
              }
              className="p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 14,
                  color: colors.textPrimary,
                }}
                numberOfLines={2}
              >
                {d.title}
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 11,
                  color: colors.textTertiary,
                  marginTop: 4,
                }}
              >
                {d.author?.display_name ?? d.author?.username ?? 'Reader'}
                {' · '}
                {relativeTime(d.updated_at)}
                {d.type ? ` · ${d.type.replace('_', ' ')}` : ''}
                {d.spoiler_tagged ? ' · spoilers' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}
