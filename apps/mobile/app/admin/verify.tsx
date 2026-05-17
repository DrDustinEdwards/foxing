// Admin: grant the verified badge to a user by username/email.
// Toggles profiles.is_verified.

import { useCallback, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, MagnifyingGlass, CheckCircle, XCircle } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface Match {
  id: string
  username: string | null
  display_name: string | null
  is_verified: boolean | null
}

export default function VerifyScreen() {
  const colors = useColors()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Match[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  const search = useCallback(async () => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, is_verified')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(25)
    setResults(((data ?? []) as unknown) as Match[])
    setSearching(false)
  }, [query])

  const toggleVerified = useCallback(async (m: Match) => {
    setBusyId(m.id)
    const next = !m.is_verified
    const { error } = await supabase
      .from('profiles')
      .update({ is_verified: next })
      .eq('id', m.id)
    if (!error) {
      setResults((prev) => prev.map((r) => (r.id === m.id ? { ...r, is_verified: next } : r)))
    } else {
      console.warn('[admin/verify] update failed:', error.message)
    }
    setBusyId(null)
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
          Grant verified badge
        </Text>
      </View>

      <View className="px-4 pb-3">
        <View
          className="flex-row items-center"
          style={{
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
          }}
        >
          <MagnifyingGlass color={colors.textTertiary} size={16} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Username or display name"
            placeholderTextColor={colors.textTertiary}
            style={{
              flex: 1,
              marginLeft: 8,
              paddingVertical: 10,
              fontFamily: Fonts.body,
              fontSize: 15,
              color: colors.textPrimary,
            }}
          />
        </View>
      </View>

      {searching ? (
        <ActivityIndicator color={colors.brandUi} style={{ marginTop: 18 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
          {results.length === 0 ? (
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textTertiary,
                paddingVertical: 24,
                textAlign: 'center',
              }}
            >
              Search for a reader to grant or revoke the verified badge.
            </Text>
          ) : (
            <View
              className="rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark overflow-hidden"
            >
              {results.map((m, i) => (
                <View
                  key={m.id}
                  className="flex-row items-center px-3 py-3"
                  style={{
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.borderSubtle,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 14,
                        color: colors.textPrimary,
                      }}
                      numberOfLines={1}
                    >
                      {m.display_name ?? m.username ?? ''}
                    </Text>
                    <Text
                      style={{
                        fontFamily: Fonts.ui,
                        fontSize: 11,
                        color: colors.textTertiary,
                      }}
                      numberOfLines={1}
                    >
                      @{m.username ?? ''} ·{' '}
                      {m.is_verified ? 'Verified' : 'Not verified'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => toggleVerified(m)}
                    disabled={busyId === m.id}
                    className="px-3 py-2 rounded-full flex-row items-center"
                    style={{
                      backgroundColor: m.is_verified ? colors.bgSelected : colors.brandUi,
                      gap: 4,
                      opacity: busyId === m.id ? 0.7 : 1,
                    }}
                  >
                    {busyId === m.id ? (
                      <ActivityIndicator
                        size="small"
                        color={m.is_verified ? colors.brandText : colors.textOnBrand}
                      />
                    ) : m.is_verified ? (
                      <XCircle color={colors.brandText} size={14} />
                    ) : (
                      <CheckCircle color={colors.textOnBrand} size={14} />
                    )}
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 12,
                        color: m.is_verified ? colors.brandText : colors.textOnBrand,
                      }}
                    >
                      {m.is_verified ? 'Revoke' : 'Grant'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
