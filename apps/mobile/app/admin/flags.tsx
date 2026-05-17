// Admin: feature flag toggles. Backed by a `feature_flags` table whose
// schema is assumed to be:
//   create table feature_flags (
//     key text primary key,
//     enabled boolean not null default false,
//     description text,
//     updated_at timestamptz not null default now()
//   );
// RLS: admins (profiles.is_admin) read/write; everyone else read-only.

import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, Plus } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface FlagRow {
  key: string
  enabled: boolean
  description: string | null
}

export default function FeatureFlagsScreen() {
  const colors = useColors()
  const router = useRouter()
  const [flags, setFlags] = useState<FlagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newKey, setNewKey] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('feature_flags')
      .select('key, enabled, description')
      .order('key', { ascending: true })
    if (error) console.warn('[admin/flags]', error.message)
    setFlags(((data ?? []) as unknown) as FlagRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggle = useCallback(
    async (key: string, enabled: boolean) => {
      setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled } : f)))
      const { error } = await supabase
        .from('feature_flags')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('key', key)
      if (error) {
        console.warn('[admin/flags] toggle:', error.message)
        // Revert.
        setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !enabled } : f)))
      }
    },
    [],
  )

  const createFlag = useCallback(async () => {
    const k = newKey.trim()
    if (!k) return
    const { error } = await supabase
      .from('feature_flags')
      .insert({ key: k, enabled: false })
    if (error) {
      console.warn('[admin/flags] create:', error.message)
      return
    }
    setNewKey('')
    load()
  }, [load, newKey])

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
          Feature flags
        </Text>
      </View>

      <View className="px-4 pb-3 flex-row items-center" style={{ gap: 8 }}>
        <TextInput
          value={newKey}
          onChangeText={setNewKey}
          placeholder="new_flag_key"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            flex: 1,
            fontFamily: Fonts.mono,
            fontSize: 13,
            color: colors.textPrimary,
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        />
        <Pressable
          onPress={createFlag}
          className="px-3 py-2 rounded-full flex-row items-center"
          style={{ backgroundColor: colors.brandUi, gap: 4 }}
        >
          <Plus color={colors.textOnBrand} size={14} />
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textOnBrand }}>
            Add
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
          {flags.length === 0 ? (
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textTertiary,
                paddingVertical: 24,
                textAlign: 'center',
              }}
            >
              No flags yet. Add one above to get started.
            </Text>
          ) : (
            <View
              className="rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark overflow-hidden"
            >
              {flags.map((f, i) => (
                <View
                  key={f.key}
                  className="flex-row items-center px-3 py-3"
                  style={{
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.borderSubtle,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text
                      style={{
                        fontFamily: Fonts.mono,
                        fontSize: 13,
                        color: colors.textPrimary,
                      }}
                    >
                      {f.key}
                    </Text>
                    {f.description ? (
                      <Text
                        style={{
                          fontFamily: Fonts.ui,
                          fontSize: 11,
                          color: colors.textTertiary,
                          marginTop: 2,
                        }}
                      >
                        {f.description}
                      </Text>
                    ) : null}
                  </View>
                  <Switch
                    value={f.enabled}
                    onValueChange={(v) => toggle(f.key, v)}
                    trackColor={{ false: colors.bgDisabled, true: colors.brandUi }}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
