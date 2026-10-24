import { usePeople } from '@foxing/client'
import { useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { FollowButton } from '@/components/profile/follow-button'
import { PersonRow } from '@/components/profile/person-row'

type Tab = 'followers' | 'following'

// The reader's own connections, from GET /people (the web People page's data).
export default function FollowsScreen() {
  const colors = useColors()
  const router = useRouter()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<Tab>(params.tab === 'followers' ? 'followers' : 'following')
  const people = usePeople()
  const following = people.data?.following ?? []
  const followers = people.data?.followers ?? []
  const open = (username: string) => router.push(`/u/${username}` as never)

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2" accessibilityLabel="Back">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary, marginLeft: 4 }}>
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
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
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
        {people.isPending ? (
          <View className="py-12 items-center">
            <ActivityIndicator color={colors.brandUi} />
          </View>
        ) : (tab === 'following' ? following.length : followers.length) === 0 ? (
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 14,
              color: colors.textTertiary,
              textAlign: 'center',
              paddingVertical: 48,
              paddingHorizontal: 24,
            }}
          >
            {tab === 'following'
              ? "You're not following anyone yet."
              : "No followers yet, once you share a profile, they'll appear here."}
          </Text>
        ) : tab === 'following' ? (
          following.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              onPress={() => open(p.username)}
              action={<FollowButton userId={p.id} isFollowing size="sm" />}
            />
          ))
        ) : (
          followers.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              onPress={() => open(p.username)}
              action={<FollowButton userId={p.id} isFollowing={p.isFollowing} size="sm" />}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
