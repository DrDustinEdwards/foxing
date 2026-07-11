import * as Sentry from '@sentry/react-native'
import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import * as Linking from 'expo-linking'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { ReaderProvider } from '@epubjs-react-native/core'
// Minimal local shape for the auth session. Supabase was removed; the shim in
// lib/supabase.ts returns `any`, so this only needs to cover what we read.
type Session = { access_token: string; refresh_token: string; user: { id: string } | null }
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
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState } from 'react-native'
import { supabase } from '@/lib/supabase'
import { rescheduleAll } from '@/lib/local-notifications'
import { checkStreakRisk } from '@/lib/streaks'
import { startOfflineWatch, stopOfflineWatch } from '@/lib/offline-queue'
import '../global.css'

Sentry.init({
  dsn: 'https://220c70037742b3e00bbfc646fd0db591@o4511169644986368.ingest.us.sentry.io/4511428406280192',
  tracesSampleRate: 0.1,
  environment: __DEV__ ? 'development' : 'production',
})

const ONBOARDING_KEY = 'onboarding_complete'

// Keep the splash screen up until both auth and fonts are ready. This prevents
// the visible flash of the platform fallback typeface that happens when the
// app paints with a system font and then re-renders once the bundled font
// asset registers.
SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore, preventAutoHideAsync rejects if the splash already auto-hid
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

function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [splashTimeoutReached, setSplashTimeoutReached] = useState(false)
  // Tri-state, null while we're checking AsyncStorage on launch.
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null)
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => setOnboardingComplete(v === 'true'))
      .catch(() => setOnboardingComplete(false))
  }, [])

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
      // A font failure shouldn't block the app forever, log and continue with
      // platform fallbacks. Visual regression is preferable to a frozen splash.
      console.warn('[fonts] failed to load', fontsError)
    }
  }, [fontsLoaded, fontsError])

  // Hard ceiling on how long the splash can stay up. If something hangs (font
  // load stuck, auth network call never resolving, etc.) we'd rather show the
  // app with platform fallbacks than freeze on the splash forever.
  useEffect(() => {
    const t = setTimeout(() => {
      console.warn('[boot] splash timeout reached, forcing ready')
      setSplashTimeoutReached(true)
    }, 8000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setSession(session)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Offline write queue, starts once at app boot. Listens for NetInfo
  // reconnect when the package is installed; falls back to polling otherwise.
  useEffect(() => {
    startOfflineWatch()
    return () => stopOfflineWatch()
  }, [])

  // Local notification scheduling + streak-risk check. Both no-op when the
  // expo-notifications native module isn't yet on the device (1.0.0 build).
  useEffect(() => {
    if (!session?.user) return
    const userId = session.user.id
    // Schedule daily reminder + 8pm streak risk based on prefs.
    rescheduleAll().catch(() => {})
    // Foreground-triggered in-app streak risk notification. Runs on mount
    // plus every time the app comes back to active state.
    checkStreakRisk(userId).catch(() => {})
    // Year-in-Reading nudge, fires once per year on Dec 1. Idempotent via
    // an AsyncStorage flag so reopening the app on Dec 1 doesn't re-send.
    ;(async () => {
      try {
        const today = new Date()
        const isDecFirst = today.getMonth() === 11 && today.getDate() === 1
        if (!isDecFirst) return
        const year = today.getFullYear()
        const flagKey = `year_in_reading_notified_${year}`
        const alreadySent = await AsyncStorage.getItem(flagKey)
        if (alreadySent === 'true') return
        const { supabase: sb } = await import('@/lib/supabase')
        const { count } = await sb
          .from('user_books')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'finished')
          .gte('finished_at', `${year}-01-01`)
        const finished = count ?? 0
        const { createNotification } = await import('@/lib/notifications')
        await createNotification(
          userId,
          'year_in_reading',
          `Your ${year} in Reading is ready`,
          `You read ${finished} book${finished === 1 ? '' : 's'} this year. See your full recap.`,
          { screen: '/year-in-reading', year, finished },
        )
        await AsyncStorage.setItem(flagKey, 'true')
      } catch (e) {
        console.warn('[year-in-reading] notify failed:', e instanceof Error ? e.message : e)
      }
    })()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkStreakRisk(userId).catch(() => {})
      }
    })
    return () => sub.remove()
  }, [session?.user])

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
    if (onboardingComplete === null) return

    const inAuthGroup = segments[0] === '(auth)'
    // Cast: Expo Router's generated route types don't refresh until Metro
    // sees the new app/onboarding/ entry. The string still works at runtime.
    const inOnboarding = (segments[0] as string) === 'onboarding'

    // Already on onboarding, never redirect to itself (would cause a loop
    // and also masks the just-completed flow before our flag re-read lands).
    if (inOnboarding) return

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
      return
    }
    if (session && inAuthGroup) {
      // Just signed in, show onboarding first if they haven't seen it.
      router.replace((onboardingComplete ? '/(tabs)' : '/onboarding') as never)
      return
    }
    if (session && !onboardingComplete) {
      // The state variable is hydrated once at mount and never refreshed,
      // so after the onboarding screen flips the AsyncStorage flag and
      // replaces to /(tabs), this effect sees a stale `false` and would
      // bounce back to /onboarding. Re-read AsyncStorage just-in-time and
      // only redirect if the flag is still genuinely missing.
      AsyncStorage.getItem(ONBOARDING_KEY)
        .then((v) => {
          if (v === 'true') {
            setOnboardingComplete(true)
          } else {
            router.replace('/onboarding' as never)
          }
        })
        .catch(() => router.replace('/onboarding' as never))
    }
  }, [session, segments, authLoading, onboardingComplete, router])

  const ready =
    splashTimeoutReached ||
    ((fontsLoaded || !!fontsError) && !authLoading && onboardingComplete !== null)

  // Hide the native splash as soon as we're ready. useEffect runs after every
  // render where `ready` is true, so this is more reliable than onLayout
  // (which only fires after the root view actually paints, and never fires
  // at all if something throws before then).
  useEffect(() => {
    if (!ready) return
    console.log('[boot] ready, hiding splash', {
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
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <KeyboardProvider>
          {/* Default Phosphor weight + size for every icon in the app. Per
              design spec the regular weight is the only one we use; setting
              it here means individual call sites don't have to remember. */}
          <IconContext.Provider value={{ weight: 'regular', size: 20 }}>
            <ReaderProvider>
              <Stack screenOptions={{ headerShown: false }} />
              <StatusBar style="auto" />
            </ReaderProvider>
          </IconContext.Provider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

export default Sentry.wrap(RootLayout)
