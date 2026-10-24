import * as Sentry from '@sentry/react-native'
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { ReaderProvider } from '@epubjs-react-native/core'
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
import { FoxingDataProvider, useMe } from '@foxing/client'
import { api, authClient, queryClient, syncNow } from '@/lib/api'
import { rescheduleAll } from '@/lib/local-notifications'
import '../global.css'

Sentry.init({
  dsn: 'https://220c70037742b3e00bbfc646fd0db591@o4511169644986368.ingest.us.sentry.io/4511428406280192',
  tracesSampleRate: 0.1,
  environment: __DEV__ ? 'development' : 'production',
})

// Keep the splash screen up until both auth and fonts are ready. This prevents
// the visible flash of the platform fallback typeface that happens when the
// app paints with a system font and then re-renders once the bundled font
// asset registers.
SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore, preventAutoHideAsync rejects if the splash already auto-hid
  // (e.g. during fast refresh). It's not actionable.
})

// Signed out goes to sign-in; signed in without a profile goes to onboarding, which
// creates it. Both come from the server: the session from Better Auth, the profile from
// GET /me.
function RootLayout() {
  const { data: session, isPending: authLoading } = authClient.useSession()
  const signedIn = !!session?.user
  const me = useMe(undefined, signedIn)
  const onboarded = me.data ? me.data.profile !== null : null
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

  // Queued offline writes go up at launch and whenever the app comes back to the front.
  useEffect(() => {
    if (!signedIn) return
    void syncNow()
    // Daily reminder and the 8pm streak nudge, from the reader's notification prefs.
    rescheduleAll().catch(() => {})
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow()
    })
    return () => sub.remove()
  }, [signedIn])

  useEffect(() => {
    if (authLoading) return
    if (signedIn && onboarded === null) return

    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = (segments[0] as string) === 'onboarding'

    if (!signedIn) {
      if (!inAuthGroup) router.replace('/(auth)/login')
      return
    }
    if (!onboarded) {
      if (!inOnboarding) router.replace('/onboarding' as never)
      return
    }
    if (inAuthGroup || inOnboarding) router.replace('/(tabs)')
  }, [signedIn, onboarded, segments, authLoading, router])

  const ready =
    splashTimeoutReached ||
    ((fontsLoaded || !!fontsError) && !authLoading && (!signedIn || onboarded !== null))

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

function App() {
  return (
    <FoxingDataProvider api={api} queryClient={queryClient}>
      <RootLayout />
    </FoxingDataProvider>
  )
}

export default Sentry.wrap(App)
