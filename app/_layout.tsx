import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as Linking from 'expo-linking'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { ReaderProvider } from '@epubjs-react-native/core'
import { Session } from '@supabase/supabase-js'
import { IconContext } from 'phosphor-react-native'
import {
  Fraunces_300Light,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  Fraunces_300Light_Italic,
  Fraunces_600SemiBold_Italic,
  Fraunces_700Bold_Italic,
} from '@expo-google-fonts/fraunces'
import {
  SourceSerif4_300Light,
  SourceSerif4_400Regular,
  SourceSerif4_600SemiBold,
  SourceSerif4_400Regular_Italic,
} from '@expo-google-fonts/source-serif-4'
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans'
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono'
import { supabase } from '@/lib/supabase'
import '../global.css'

// Keep the splash screen up until both auth and fonts are ready. This prevents
// the visible flash of the platform fallback typeface that happens when the
// app paints with a system font and then re-renders once the bundled font
// asset registers.
SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore — preventAutoHideAsync rejects if the splash already auto-hid
  // (e.g. during fast refresh). It's not actionable.
})

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
  const [authLoading, setAuthLoading] = useState(true)
  const [splashTimeoutReached, setSplashTimeoutReached] = useState(false)
  const segments = useSegments()
  const router = useRouter()

  const [fontsLoaded, fontsError] = useFonts({
    Fraunces_300Light,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Fraunces_300Light_Italic,
    Fraunces_600SemiBold_Italic,
    Fraunces_700Bold_Italic,
    SourceSerif4_300Light,
    SourceSerif4_400Regular,
    SourceSerif4_600SemiBold,
    SourceSerif4_400Regular_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMMono_400Regular,
    DMMono_500Medium,
  })

  useEffect(() => {
    console.log('[boot] fonts state', { fontsLoaded, fontsError: fontsError?.message })
    if (fontsError) {
      // A font failure shouldn't block the app forever — log and continue with
      // platform fallbacks. Visual regression is preferable to a frozen splash.
      console.warn('[fonts] failed to load', fontsError)
    }
  }, [fontsLoaded, fontsError])

  // Hard ceiling on how long the splash can stay up. If something hangs (font
  // load stuck, auth network call never resolving, etc.) we'd rather show the
  // app with platform fallbacks than freeze on the splash forever.
  useEffect(() => {
    const t = setTimeout(() => {
      console.warn('[boot] splash timeout reached — forcing ready')
      setSplashTimeoutReached(true)
    }, 8000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
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
    if (authLoading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [session, segments, authLoading])

  const ready =
    splashTimeoutReached || ((fontsLoaded || !!fontsError) && !authLoading)

  // Hide the native splash as soon as we're ready. useEffect runs after every
  // render where `ready` is true, so this is more reliable than onLayout
  // (which only fires after the root view actually paints — and never fires
  // at all if something throws before then).
  useEffect(() => {
    if (!ready) return
    console.log('[boot] ready — hiding splash', {
      fontsLoaded,
      fontsError: fontsError?.message,
      authLoading,
      timedOut: splashTimeoutReached,
    })
    SplashScreen.hideAsync().catch((e) => {
      console.warn('[boot] hideAsync failed', e)
    })
  }, [ready, fontsLoaded, fontsError, authLoading, splashTimeoutReached])

  // Render nothing until ready. The native splash stays up because we called
  // preventAutoHideAsync at module load.
  if (!ready) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Default Phosphor weight + size for every icon in the app. Per
          design spec the regular weight is the only one we use; setting
          it here means individual call sites don't have to remember. */}
      <IconContext.Provider value={{ weight: 'regular', size: 20 }}>
        <ReaderProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="auto" />
        </ReaderProvider>
      </IconContext.Provider>
    </GestureHandlerRootView>
  )
}
