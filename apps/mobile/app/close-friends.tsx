import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { CaretLeft, X as XIcon, Plus } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  addCloseFriend,
  getCloseFriends,
  removeCloseFriend,
  type CloseFriendProfile,
} from '@/lib/close-friends'

interface FollowerProfile {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

export default function CloseFriendsScreen() {
  const colors = useColors()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [friends, setFriends] = useState<CloseFriendProfile[]>([])
  const [eligibleFollowers, setEligibleFollowers] = useState<FollowerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setUserId(user.id)
    const list = await getCloseFriends(user.id)
    setFriends(list)
    // Followers who AREN'T already close friends become add candidates.
    const friendIds = new Set(list.map((f) => f.id))
    const { data: followsData } = await supabase
      .from('follows')
      .select('follower:profiles!follower_id(id, display_name, username, avatar_url)')
      .eq('following_id', user.id)
      .limit(200)
    type R = {
      follower:
        | FollowerProfile
        | Array<FollowerProfile>
        | null
    }
    const followers: FollowerProfile[] = []
    for (const r of ((followsData ?? []) as unknown) as R[]) {
      const f = Array.isArray(r.follower) ? r.follower[0] ?? null : r.follower
      if (f && !friendIds.has(f.id)) followers.push(f)
    }
    followers.sort((a, b) =>
      (a.display_name ?? a.username ?? '').localeCompare(b.display_name ?? b.username ?? ''),
    )
    setEligibleFollowers(followers)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useFocusEffect(useCallback(() => { load() }, [load]))

  const onRemove = useCallback(
    async (friend: CloseFriendProfile) => {
      if (!userId || busyId) return
      setBusyId(friend.id)
      const ok = await removeCloseFriend(userId, friend.id)
      setBusyId(null)
      if (ok) load()
    },
    [busyId, load, userId],
  )

  const onAdd = useCallback(
    async (follower: FollowerProfile) => {
      if (!userId || busyId) return
      setBusyId(follower.id)
      const ok = await addCloseFriend(userId, follower.id)
      setBusyId(null)
      if (ok) load()
    },
    [busyId, load, userId],
  )

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="p-2"
        >
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 18,
            color: colors.textPrimary,
            marginLeft: 4,
          }}
        >
          Close Friends
        </Text>
      </View>
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: 13,
          color: colors.textSecondary,
          paddingHorizontal: 16,
          marginBottom: 8,
        }}
      >
        Close friends see your Private posts and diary entries.
      </Text>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {/* Current close friends */}
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 8,
            }}
          >
            Your close friends
          </Text>
          {friends.length === 0 ? (
            <View
              className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              style={{ marginBottom: 16 }}
            >
              <Text
                style={{
                  fontFamily: Fonts.body,
                  fontSize: 13,
                  color: colors.textTertiary,
                }}
              >
                Add people you trust from your followers below.
              </Text>
            </View>
          ) : (
            friends.map((f) => (
              <PersonRow
                key={f.id}
                profile={f}
                action="remove"
                busy={busyId === f.id}
                onPress={() => onRemove(f)}
              />
            ))
          )}

          {/* Followers eligible to add */}
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginTop: 18,
              marginBottom: 8,
            }}
          >
            Add from followers
          </Text>
          {eligibleFollowers.length === 0 ? (
            <View
              className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text
                style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textTertiary }}
              >
                {friends.length > 0
                  ? "You've added everyone who follows you."
                  : 'No followers yet, share Foxing with a friend.'}
              </Text>
            </View>
          ) : (
            eligibleFollowers.map((p) => (
              <PersonRow
                key={p.id}
                profile={p}
                action="add"
                busy={busyId === p.id}
                onPress={() => onAdd(p)}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function PersonRow({
  profile,
  action,
  busy,
  onPress,
}: {
  profile: FollowerProfile | CloseFriendProfile
  action: 'add' | 'remove'
  busy: boolean
  onPress: () => void
}) {
  const colors = useColors()
  const name = profile.display_name ?? profile.username ?? 'Reader'
  const handle = profile.username ? `@${profile.username}` : ''
  return (
    <View
      className="flex-row items-center p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.brandSubtle,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}
      >
        {profile.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={{ width: '100%', height: '100%' }}
            accessibilityRole="image"
            accessibilityLabel={`${name} avatar`}
          />
        ) : (
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 14,
              color: colors.brandSubtleText,
            }}
          >
            {name[0]?.toUpperCase() ?? '?'}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
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
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={action === 'add' ? `Add ${name}` : `Remove ${name}`}
        accessibilityState={{ disabled: busy, busy }}
        className="flex-row items-center px-3 py-2 rounded-full"
        style={{
          backgroundColor: action === 'add' ? colors.brandUi : colors.bgBase,
          borderWidth: action === 'remove' ? 1 : 0,
          borderColor: colors.borderInteractive,
          opacity: busy ? 0.7 : 1,
          gap: 4,
        }}
      >
        {busy ? (
          <ActivityIndicator
            color={action === 'add' ? colors.textOnBrand : colors.textPrimary}
            size="small"
          />
        ) : action === 'add' ? (
          <>
            <Plus color={colors.textOnBrand} size={12} weight="bold" />
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textOnBrand }}
            >
              Add
            </Text>
          </>
        ) : (
          <>
            <XIcon color={colors.textPrimary} size={12} />
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textPrimary }}
            >
              Remove
            </Text>
          </>
        )}
      </Pressable>
    </View>
  )
}
