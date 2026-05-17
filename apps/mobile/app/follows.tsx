import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

type Tab = 'followers' | 'following'

interface ProfileRow {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
}

export default function FollowsScreen() {
  const colors = useColors()
  const router = useRouter()
  const params = useLocalSearchParams<{ tab?: string; userId?: string }>()
  const initialTab: Tab = params.tab === 'followers' ? 'followers' : 'following'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [rows, setRows] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    // Subject = whose connections we're viewing. Default = the signed-in user;
    // override via ?userId=X when arriving from another reader's profile.
    let uid = params.userId ?? null
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser()
      uid = user?.id ?? null
    }
    if (!uid) {
      setRows([])
      setLoading(false)
      return
    }
    // follows FKs point at auth.users, so we can't relation-join to profiles.
    // pull the ID list first, then hydrate.
    const idColumn = tab === 'followers' ? 'follower_id' : 'following_id'
    const filterColumn = tab === 'followers' ? 'following_id' : 'follower_id'
    const { data: edges } = await supabase
      .from('follows')
      .select(idColumn)
      .eq(filterColumn, uid)

    const ids = ((edges ?? []) as Array<Record<string, string>>).map((e) => e[idColumn])
    if (ids.length === 0) {
      setRows([])
      setLoading(false)
      return
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio')
      .in('id', ids)
    setRows((profiles ?? []) as ProfileRow[])
    setLoading(false)
  }, [tab, params.userId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary, marginLeft: 4 }}
        >
          Connections
        </Text>
      </View>

      <View className="flex-row px-4 mb-4">
        {(['following', 'followers'] as Tab[]).map((t) => {
          const active = tab === t
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className="flex-1 py-2 items-center"
              style={{
                borderBottomWidth: 2,
                borderBottomColor: active ? colors.borderInteractive : colors.borderSubtle,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 13,
                  color: active ? colors.brandText : colors.textTertiary,
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color={colors.brandUi} />
          </View>
        ) : rows.length === 0 ? (
          <View className="items-center py-16 px-8">
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 14,
                color: colors.textTertiary,
                textAlign: 'center',
              }}
            >
              {tab === 'following'
                ? "You're not following anyone yet."
                : "No followers yet, once you share a profile, they'll appear here."}
            </Text>
          </View>
        ) : (
          rows.map((p) => (
            <PersonRow
              key={p.id}
              profile={p}
              onPress={() => router.push(`/user/${p.id}` as never)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function PersonRow({ profile, onPress }: { profile: ProfileRow; onPress?: () => void }) {
  const colors = useColors()
  const initial = (profile.display_name || profile.username || '?')[0]?.toUpperCase() ?? '?'
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${profile.display_name ?? profile.username ?? 'reader'} profile`}
      className="flex-row items-center py-3 px-3 mb-2 rounded-xl bg-bg-surface-light dark:bg-bg-surface-dark border border-border-subtle-light dark:border-border-subtle-dark"
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          overflow: 'hidden',
          backgroundColor: colors.brandSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.brandSubtleText }}>
            {initial}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}
          numberOfLines={1}
        >
          {profile.display_name ?? 'Reader'}
        </Text>
        <Text
          style={{ fontFamily: Fonts.mono, fontSize: 12, color: colors.textTertiary }}
          numberOfLines={1}
        >
          @{profile.username ?? 'reader'}
        </Text>
        {profile.bio ? (
          <Text
            style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}
            numberOfLines={1}
          >
            {profile.bio}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}
