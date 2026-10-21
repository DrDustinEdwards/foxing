// Public, shareable club page, read-only summary visible without joining.
// Used as the destination for "Share club" links so non-members get a
// friendly landing screen with a join button instead of being dropped into
// the full member-only thread view.

import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  CaretLeft,
  BookOpen,
  UsersThree,
  ShareNetwork,
  ChatCircle,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { supabase } from '@/lib/supabase'
import {
  fetchClub,
  fetchMembers,
  joinClub,
  isMember,
  type ClubMember,
  type ClubThread,
  type ClubWithBook,
} from '@/lib/clubs'
import { fetchThreads } from '@/lib/club-threads'

export default function PublicClubScreen() {
  const colors = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [club, setClub] = useState<ClubWithBook | null>(null)
  const [members, setMembers] = useState<ClubMember[]>([])
  const [threads, setThreads] = useState<ClubThread[]>([])
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [joinedRole, setJoinedRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setViewerId(user?.id ?? null)
    const [c, m, t, r] = await Promise.all([
      fetchClub(id),
      fetchMembers(id),
      fetchThreads(id),
      user ? isMember(id, user.id) : Promise.resolve(null),
    ])
    setClub(c)
    setMembers(m)
    setThreads(t.slice(0, 5))
    setJoinedRole(r)
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const onJoin = useCallback(async () => {
    if (!id || !viewerId || joining) return
    setJoining(true)
    const ok = await joinClub(id)
    setJoining(false)
    if (ok) router.replace(`/clubs/${id}` as never)
  }, [id, joining, router, viewerId])

  const onShare = useCallback(async () => {
    if (!club || !id) return
    const url = `foxing://clubs/public/${id}`
    await Share.share({
      message: `Join my book club on Foxing: ${club.name}\n${url}`,
    })
  }, [club, id])

  if (loading || !club) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }

  // Already a member, bounce them to the real club page.
  if (joinedRole) {
    router.replace(`/clubs/${id}` as never)
    return null
  }

  const book = club.current_book

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center justify-between px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Pressable onPress={onShare} hitSlop={10} className="p-2">
          <ShareNetwork color={colors.textPrimary} size={20} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {/* Hero */}
        <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 16 }}>
          {book?.cover_url ? (
            <View
              style={{
                width: 96,
                height: 140,
                borderRadius: 6,
                overflow: 'hidden',
                marginBottom: 14,
              }}
            >
              <Image source={{ uri: book.cover_url }} style={{ width: '100%', height: '100%' }} />
            </View>
          ) : (
            <View
              style={{
                width: 96,
                height: 140,
                borderRadius: 6,
                backgroundColor: colors.bgSunken,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <UsersThree color={colors.textTertiary} size={28} />
            </View>
          )}
          <Text
            style={{
              fontFamily: Fonts.displayBold,
              fontSize: 24,
              color: colors.textPrimary,
              textAlign: 'center',
            }}
          >
            {club.name}
          </Text>
          {book ? (
            <Text
              style={{
                fontFamily: Fonts.bodyItalic,
                fontSize: 13,
                color: colors.textTertiary,
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              Reading {book.title} by {book.author}
            </Text>
          ) : null}
          <View className="flex-row items-center" style={{ marginTop: 10, gap: 14 }}>
            <Stat
              icon={<UsersThree color={colors.textSecondary} size={14} />}
              label={`${club.member_count} member${club.member_count === 1 ? '' : 's'}`}
            />
            <Stat
              icon={<ChatCircle color={colors.textSecondary} size={14} />}
              label={`${threads.length}+ discussion${threads.length === 1 ? '' : 's'}`}
            />
          </View>
        </View>

        {/* About */}
        {club.description ? (
          <View
            className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            style={{ marginBottom: 14 }}
          >
            <Text
              style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textPrimary, lineHeight: 21 }}
            >
              {club.description}
            </Text>
          </View>
        ) : null}

        {/* Member preview */}
        {members.length > 0 ? (
          <View
            className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            style={{ marginBottom: 14 }}
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
              Members
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {members.slice(0, 12).map((m) => {
                const name = m.profile?.display_name ?? m.profile?.username ?? '?'
                const initial = (name[0] ?? '?').toUpperCase()
                return (
                  <View
                    key={m.user_id}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.brandSubtle,
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
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
                          fontFamily: Fonts.uiMedium,
                          fontSize: 14,
                          color: colors.brandSubtleText,
                        }}
                      >
                        {initial}
                      </Text>
                    )}
                  </View>
                )
              })}
              {members.length > 12 ? (
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.bgSunken,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}
                  >
                    +{members.length - 12}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Recent threads preview, titles only, body locked until they join. */}
        {threads.length > 0 ? (
          <View
            className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
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
              Recent discussions
            </Text>
            <View style={{ gap: 10 }}>
              {threads.map((t) => (
                <View key={t.id}>
                  <Text
                    style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
                    numberOfLines={2}
                  >
                    {t.title}
                  </Text>
                  {t.chapter ? (
                    <Text
                      style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}
                    >
                      {t.chapter} · {t.post_count} post{t.post_count === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky CTA */}
      <View
        className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 border-t bg-bg-base-light dark:bg-bg-base-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        {viewerId ? (
          <Pressable
            onPress={onJoin}
            disabled={joining}
            className="py-3 rounded-full items-center"
            style={{ backgroundColor: colors.brandUi, opacity: joining ? 0.7 : 1 }}
          >
            {joining ? (
              <ActivityIndicator color={colors.textOnBrand} />
            ) : (
              <Text
                style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textOnBrand }}
              >
                Join club
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/login' as never)}
            className="py-3 rounded-full items-center"
            style={{ backgroundColor: colors.brandUi }}
          >
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textOnBrand }}
            >
              Sign in to join
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  )
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  const colors = useColors()
  return (
    <View className="flex-row items-center" style={{ gap: 4 }}>
      {icon}
      <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textSecondary }}>
        {label}
      </Text>
    </View>
  )
}
