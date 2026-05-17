// Admin: triage user-submitted reports of club posts / passage comments.
// Backed by `reports` table assumed shape:
//   create table reports (
//     id uuid primary key default gen_random_uuid(),
//     reporter_id uuid references profiles(id),
//     target_kind text not null check (target_kind in ('club_post','passage_comment')),
//     target_id uuid not null,
//     reason text,
//     status text not null default 'open' check (status in ('open','dismissed','actioned')),
//     created_at timestamptz not null default now()
//   );

import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, X as XIcon, Trash, UserCircleMinus } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

type TargetKind = 'club_post' | 'passage_comment'

interface ReportRow {
  id: string
  reporter_id: string | null
  target_kind: TargetKind
  target_id: string
  reason: string | null
  status: 'open' | 'dismissed' | 'actioned'
  created_at: string
  // Hydrated client-side.
  preview?: string
  authorId?: string | null
  authorName?: string | null
}

export default function ReportsScreen() {
  const colors = useColors()
  const router = useRouter()
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('reports')
      .select('id, reporter_id, target_kind, target_id, reason, status, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(100)
    const rows = ((data ?? []) as unknown) as ReportRow[]
    // Hydrate target previews so admins don't have to click through to read.
    const postIds = rows.filter((r) => r.target_kind === 'club_post').map((r) => r.target_id)
    const commentIds = rows.filter((r) => r.target_kind === 'passage_comment').map((r) => r.target_id)
    const [postsRes, commentsRes] = await Promise.all([
      postIds.length > 0
        ? supabase
            .from('club_posts')
            .select('id, body, user_id, author:profiles!user_id(display_name, username)')
            .in('id', postIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      commentIds.length > 0
        ? supabase
            .from('passage_comments')
            .select('id, body, user_id, author:profiles!user_id(display_name, username)')
            .in('id', commentIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    ])
    const previewById = new Map<string, { preview: string; authorId: string | null; authorName: string | null }>()
    type PR = {
      id: string
      body: string
      user_id: string | null
      author:
        | { display_name: string | null; username: string | null }
        | Array<{ display_name: string | null; username: string | null }>
        | null
    }
    for (const r of (((postsRes.data ?? []) as unknown) as PR[])) {
      const a = Array.isArray(r.author) ? r.author[0] : r.author
      previewById.set(r.id, {
        preview: r.body,
        authorId: r.user_id,
        authorName: a?.display_name ?? a?.username ?? null,
      })
    }
    for (const r of (((commentsRes.data ?? []) as unknown) as PR[])) {
      const a = Array.isArray(r.author) ? r.author[0] : r.author
      previewById.set(r.id, {
        preview: r.body,
        authorId: r.user_id,
        authorName: a?.display_name ?? a?.username ?? null,
      })
    }
    for (const r of rows) {
      const hit = previewById.get(r.target_id)
      if (hit) {
        r.preview = hit.preview
        r.authorId = hit.authorId
        r.authorName = hit.authorName
      }
    }
    setReports(rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const dismiss = useCallback(async (id: string) => {
    await supabase.from('reports').update({ status: 'dismissed' }).eq('id', id)
    setReports((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const deletePost = useCallback(async (r: ReportRow) => {
    Alert.alert('Delete reported content?', 'This permanently removes the post.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const table = r.target_kind === 'club_post' ? 'club_posts' : 'passage_comments'
          await supabase.from(table).delete().eq('id', r.target_id)
          await supabase.from('reports').update({ status: 'actioned' }).eq('id', r.id)
          setReports((prev) => prev.filter((x) => x.id !== r.id))
        },
      },
    ])
  }, [])

  const banUser = useCallback(async (r: ReportRow) => {
    if (!r.authorId) return
    Alert.alert(
      'Ban this user?',
      `${r.authorName ?? 'Unknown'} will be marked banned and signed out of any active sessions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('profiles').update({ is_banned: true }).eq('id', r.authorId!)
            await supabase.from('reports').update({ status: 'actioned' }).eq('id', r.id)
            setReports((prev) => prev.filter((x) => x.id !== r.id))
          },
        },
      ],
    )
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{
            fontFamily: Fonts.display,
            fontSize: 18,
            color: colors.textPrimary,
            marginLeft: 4,
          }}
        >
          Reports queue
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 10 }}>
          {reports.length === 0 ? (
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textTertiary,
                paddingVertical: 24,
                textAlign: 'center',
              }}
            >
              No open reports. Nice.
            </Text>
          ) : (
            reports.map((r) => (
              <View
                key={r.id}
                className="p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              >
                <View className="flex-row items-center" style={{ marginBottom: 6 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 10,
                      color: colors.textTertiary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                    }}
                  >
                    {r.target_kind.replace('_', ' ')}
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 11,
                      color: colors.textTertiary,
                      marginLeft: 'auto',
                    }}
                  >
                    {new Date(r.created_at).toLocaleString()}
                  </Text>
                </View>
                {r.authorName ? (
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 12,
                      color: colors.textPrimary,
                      marginBottom: 2,
                    }}
                  >
                    by {r.authorName}
                  </Text>
                ) : null}
                {r.reason ? (
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginBottom: 6,
                    }}
                  >
                    Reason: {r.reason}
                  </Text>
                ) : null}
                {r.preview ? (
                  <View
                    style={{
                      padding: 10,
                      backgroundColor: colors.bgSunken,
                      borderRadius: 8,
                      marginBottom: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.body,
                        fontSize: 13,
                        color: colors.textPrimary,
                        lineHeight: 19,
                      }}
                      numberOfLines={6}
                    >
                      {r.preview}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={{
                      fontFamily: Fonts.body,
                      fontSize: 12,
                      color: colors.textTertiary,
                      marginBottom: 10,
                    }}
                  >
                    (Target deleted before triage)
                  </Text>
                )}
                <View className="flex-row" style={{ gap: 6 }}>
                  <ReportAction Icon={XIcon} label="Dismiss" onPress={() => dismiss(r.id)} />
                  <ReportAction
                    Icon={Trash}
                    label="Delete post"
                    onPress={() => deletePost(r)}
                    destructive
                  />
                  {r.authorId ? (
                    <ReportAction
                      Icon={UserCircleMinus}
                      label="Ban user"
                      onPress={() => banUser(r)}
                      destructive
                    />
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function ReportAction({
  Icon,
  label,
  onPress,
  destructive,
}: {
  Icon: React.ComponentType<{ color: string; size: number }>
  label: string
  onPress: () => void
  destructive?: boolean
}) {
  const colors = useColors()
  const tint = destructive ? colors.error : colors.textPrimary
  return (
    <Pressable
      onPress={onPress}
      className="px-3 py-1 rounded-full border flex-row items-center"
      style={{ borderColor: destructive ? colors.error : colors.borderInteractive, gap: 4 }}
    >
      <Icon color={tint} size={12} />
      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: tint }}>{label}</Text>
    </Pressable>
  )
}
