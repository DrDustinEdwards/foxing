import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// Deeplink target, `foxing://u/<username>` lands here. We resolve the
// username to a user_id and `replace()` to /user/[id] so the back stack
// doesn't have a placeholder hop. If the lookup misses, show a small
// not-found state instead of redirecting blindly.
export default function UsernameRedirectScreen() {
  const colors = useColors()
  const router = useRouter()
  const { username } = useLocalSearchParams<{ username: string }>()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!username) {
        setNotFound(true)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()
      if (cancelled) return
      const id = (data as { id?: string } | null)?.id
      if (id) router.replace(`/user/${id}` as never)
      else setNotFound(true)
    })()
    return () => {
      cancelled = true
    }
  }, [router, username])

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark px-8">
      {notFound ? (
        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 14,
              color: colors.textTertiary,
              textAlign: 'center',
            }}
          >
            No reader named @{username}.
          </Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>Back</Text>
          </Pressable>
        </View>
      ) : (
        <ActivityIndicator color={colors.brandUi} />
      )}
    </SafeAreaView>
  )
}
