import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, LockSimple } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { badgeIcon, type BadgeRow } from '@/lib/badges'

interface BadgeWithState extends BadgeRow {
  earnedAt: string | null
}

export default function BadgesScreen() {
  const colors = useColors()
  const router = useRouter()
  const [items, setItems] = useState<BadgeWithState[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setItems([])
      setLoading(false)
      return
    }
    const [{ data: all }, { data: earned }] = await Promise.all([
      supabase
        .from('badges')
        .select('id, slug, name, description, icon, category')
        .order('category', { ascending: true })
        .order('slug', { ascending: true }),
      supabase
        .from('user_badges')
        .select('badge_id, earned_at')
        .eq('user_id', user.id),
    ])
    const earnedMap = new Map<string, string>()
    for (const e of (earned ?? []) as Array<{ badge_id: string; earned_at: string }>) {
      earnedMap.set(e.badge_id, e.earned_at)
    }
    setItems(
      ((all ?? []) as BadgeRow[]).map((b) => ({
        ...b,
        earnedAt: earnedMap.get(b.id!) ?? null,
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const earnedCount = items.filter((b) => b.earnedAt).length

  // Group by category for visual structure.
  const byCategory = items.reduce<Record<string, BadgeWithState[]>>((acc, b) => {
    const k = b.category ?? 'other'
    ;(acc[k] ??= []).push(b)
    return acc
  }, {})
  const categoryOrder = ['reading', 'streak', 'social', 'club', 'milestone']
  const orderedKeys = [
    ...categoryOrder.filter((k) => byCategory[k]),
    ...Object.keys(byCategory).filter((k) => !categoryOrder.includes(k)),
  ]

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary, marginLeft: 4 }}
        >
          Badges
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color={colors.brandUi} />
          </View>
        ) : (
          <>
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 13,
                color: colors.textTertiary,
                marginBottom: 16,
              }}
            >
              {earnedCount} of {items.length} earned
            </Text>
            {orderedKeys.map((cat) => (
              <View key={cat} style={{ marginBottom: 24 }}>
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
                  {cat}
                </Text>
                <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
                  {byCategory[cat].map((b) => (
                    <BadgeTile key={b.slug} badge={b} />
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function BadgeTile({ badge }: { badge: BadgeWithState }) {
  const colors = useColors()
  const Icon = badgeIcon(badge.slug)
  const earned = !!badge.earnedAt
  return (
    <View
      style={{
        width: '47%',
        margin: 4,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        backgroundColor: earned ? colors.bgSurface : colors.bgSunken,
        borderColor: earned ? colors.borderSubtle : colors.borderSubtle,
        opacity: earned ? 1 : 0.65,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: earned ? colors.brandSubtle : colors.bgHover,
          marginBottom: 10,
        }}
      >
        {earned ? (
          <Icon color={colors.brandSubtleText} size={24} weight="regular" />
        ) : (
          <LockSimple color={colors.textTertiary} size={20} weight="regular" />
        )}
      </View>
      <Text
        style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
        numberOfLines={1}
      >
        {badge.name}
      </Text>
      {badge.description ? (
        <Text
          style={{
            fontFamily: Fonts.ui,
            fontSize: 12,
            color: colors.textTertiary,
            marginTop: 2,
            lineHeight: 16,
          }}
          numberOfLines={3}
        >
          {badge.description}
        </Text>
      ) : null}
    </View>
  )
}
