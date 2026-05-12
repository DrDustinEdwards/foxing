import { useEffect, useState, useCallback } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'

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
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#1A1208' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View className="items-center mt-4 mb-8">
          <View
            className="w-24 h-24 rounded-full items-center justify-center mb-3"
            style={{ backgroundColor: '#2A1F0F' }}
          >
            <Text className="text-3xl" style={{ color: '#C4973A' }}>
              {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text className="text-2xl font-serif" style={{ color: '#E8D5B0' }}>
            {profile?.display_name ?? 'Reader'}
          </Text>
          <Text style={{ color: '#8B6914' }}>@{profile?.username ?? 'reader'}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#8B6914" />
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
          className="rounded-xl py-4 items-center"
          style={{ backgroundColor: '#2A1F0F', borderWidth: 1, borderColor: '#3D2B1F' }}
        >
          <Text style={{ color: '#D32F2F' }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View
      className="rounded-xl p-4 mb-3"
      style={{ width: '48%', backgroundColor: '#2A1F0F' }}
    >
      <Text className="text-3xl font-serif" style={{ color: '#C4973A' }}>
        {value}
      </Text>
      <Text className="text-xs mt-1" style={{ color: '#8B6914' }}>
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
