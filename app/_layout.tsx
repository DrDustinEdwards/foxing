import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as Linking from 'expo-linking'
import { ReaderProvider } from '@epubjs-react-native/core'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import '../global.css'

// Parse tokens out of a Supabase auth deep link. Email-confirmation links
// land here as foxing://auth/callback#access_token=...&refresh_token=...
// (implicit flow) or foxing://auth/callback?code=... (PKCE flow).
async function handleAuthDeepLink(url: string) {
  console.log('[deeplink] incoming URL', url)

  const hashIndex = url.indexOf('#')
  if (hashIndex >= 0) {
    const fragment = new URLSearchParams(url.slice(hashIndex + 1))
    const access_token = fragment.get('access_token')
    const refresh_token = fragment.get('refresh_token')
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      console.log('[deeplink] setSession result', { error: error?.message })
      return
    }
  }

  const queryIndex = url.indexOf('?')
  if (queryIndex >= 0) {
    const query = new URLSearchParams(
      url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined),
    )
    const code = query.get('code')
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      console.log('[deeplink] exchangeCodeForSession result', { error: error?.message })
    }
  }
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    // Cold start: the app was launched by tapping the email link.
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthDeepLink(url)
    })

    // Warm start: the app was already running when the link was tapped.
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleAuthDeepLink(url)
    })

    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [session, segments, loading])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background.dark }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReaderProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="auto" />
      </ReaderProvider>
    </GestureHandlerRootView>
  )
}
