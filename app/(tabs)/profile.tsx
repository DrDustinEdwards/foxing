import { useEffect, useState, useCallback } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'

interface Profile {
  display_name: string | null
  username: string | null
}

interface Stats {
  finished: number
  streak: number
  pages: number
  vocab: number
}

export default function ProfileScreen() {
  const colors = useColors()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<Stats>({ finished: 0, streak: 0, pages: 0, vocab: 0 })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const [profileRes, finishedRes, sessionsRes, vocabRes] = await Promise.all([
      supabase.from('profiles').select('display_name, username').eq('id', user.id).single(),
      supabase
        .from('user_books')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'finished'),
      supabase
        .from('reading_sessions')
        .select('pages_read, started_at')
        .eq('user_id', user.id),
      supabase
        .from('vocabulary')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ])

    setProfile(profileRes.data ?? null)

    const totalPages = (sessionsRes.data ?? []).reduce(
      (sum, s: { pages_read: number | null }) => sum + (s.pages_read ?? 0),
      0
    )
    const streak = computeStreak((sessionsRes.data ?? []).map((s) => s.started_at as string))

    setStats({
      finished: finishedRes.count ?? 0,
      streak,
      pages: totalPages,
      vocab: vocabRes.count ?? 0,
    })
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  useEffect(() => {
    load()
  }, [load])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View className="items-center mt-4 mb-8">
          <View className="w-24 h-24 rounded-full items-center justify-center mb-3 bg-brand-subtle-light dark:bg-brand-subtle-dark">
            <Text className="font-display text-3xl text-brand-subtle-text-light dark:text-brand-subtle-text-dark">
              {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text className="font-display text-2xl text-text-primary-light dark:text-text-primary-dark">
            {profile?.display_name ?? 'Reader'}
          </Text>
          <Text className="font-mono text-text-tertiary-light dark:text-text-tertiary-dark">
            @{profile?.username ?? 'reader'}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brandUi} />
        ) : (
          <View className="flex-row flex-wrap justify-between mb-8">
            <StatCard label="Books finished" value={stats.finished} />
            <StatCard label="Day streak" value={stats.streak} />
            <StatCard label="Pages read" value={stats.pages} />
            <StatCard label="Words learned" value={stats.vocab} />
          </View>
        )}

        <Pressable
          onPress={signOut}
          className="flex-row justify-center items-center gap-2 rounded-xl py-4 border border-border-interactive-light dark:border-border-interactive-dark bg-bg-surface-light dark:bg-bg-surface-dark"
        >
          <Text className="font-ui text-error-light dark:text-error-dark">✕</Text>
          <Text className="font-ui text-error-light dark:text-error-dark">Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View
      className="rounded-xl p-4 mb-3 bg-bg-surface-light dark:bg-bg-surface-dark border border-border-subtle-light dark:border-border-subtle-dark"
      style={{ width: '48%' }}
    >
      <Text className="font-display text-3xl text-brand-text-light dark:text-brand-text-dark">
        {value}
      </Text>
      <Text className="font-ui text-xs mt-1 text-text-tertiary-light dark:text-text-tertiary-dark">
        {label}
      </Text>
    </View>
  )
}

function computeStreak(timestamps: string[]): number {
  if (timestamps.length === 0) return 0
  const days = new Set(
    timestamps
      .filter(Boolean)
      .map((ts) => new Date(ts).toISOString().slice(0, 10))
  )
  let streak = 0
  const cursor = new Date()
  while (true) {
    const key = cursor.toISOString().slice(0, 10)
    if (days.has(key)) {
      streak += 1
      cursor.setUTCDate(cursor.getUTCDate() - 1)
    } else {
      break
    }
  }
  return streak
}
