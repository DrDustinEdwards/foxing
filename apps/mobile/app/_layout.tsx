import * as Sentry from "@sentry/react-native";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { ReaderProvider } from "@epubjs-react-native/core";
import { IconContext } from "phosphor-react-native";
import {
  Fraunces_300Light,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  Fraunces_300Light_Italic,
  Fraunces_600SemiBold_Italic,
  Fraunces_700Bold_Italic,
} from "@expo-google-fonts/fraunces";
import {
  SourceSerif4_300Light,
  SourceSerif4_400Regular,
  SourceSerif4_600SemiBold,
  SourceSerif4_400Regular_Italic,
} from "@expo-google-fonts/source-serif-4";
import { DMSans_400Regular, DMSans_500Medium } from "@expo-google-fonts/dm-sans";
import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import { FoxingDataProvider, useMe } from "@foxing/client";
import { ErrorState } from "@/components/ui/error-state";
import { api, authClient, queryClient, syncNow } from "@/lib/api";
import { rescheduleAll } from "@/lib/local-notifications";
import "../global.css";

Sentry.init({
  dsn: "https://220c70037742b3e00bbfc646fd0db591@o4511169644986368.ingest.us.sentry.io/4511428406280192",
  tracesSampleRate: 0.1,
  environment: __DEV__ ? "development" : "production",
});

SplashScreen.preventAutoHideAsync().catch(() => {
  // rejects if the splash already auto-hid (fast refresh); not actionable
});

function RootLayout() {
  const { data: session, isPending: authLoading } = authClient.useSession();
  const signedIn = !!session?.user;
  const me = useMe(undefined, signedIn);
  const onboarded = me.data ? me.data.profile !== null : null;
  const [splashTimeoutReached, setSplashTimeoutReached] = useState(false);
  const segments = useSegments();
  const router = useRouter();

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
  });

  useEffect(() => {
    console.log("[boot] fonts state", { fontsLoaded, fontsError: fontsError?.message });
    if (fontsError) {
      // A font failure must not freeze the splash; continue with platform fallbacks.
      console.warn("[fonts] failed to load", fontsError);
    }
  }, [fontsLoaded, fontsError]);

  // Hard ceiling so a hung font or auth call cannot freeze the splash.
  useEffect(() => {
    const t = setTimeout(() => {
      console.warn("[boot] splash timeout reached, forcing ready");
      setSplashTimeoutReached(true);
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    void syncNow();
    rescheduleAll().catch(() => {});
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow();
    });
    return () => sub.remove();
  }, [signedIn]);

  useEffect(() => {
    if (authLoading) return;
    if (signedIn && onboarded === null) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = (segments[0] as string) === "onboarding";

    if (!signedIn) {
      if (!inAuthGroup) router.replace("/(auth)/login");
      return;
    }
    if (!onboarded) {
      if (!inOnboarding) router.replace("/onboarding" as never);
      return;
    }
    if (inAuthGroup || inOnboarding) router.replace("/(tabs)");
  }, [signedIn, onboarded, segments, authLoading, router]);

  const meFailed = signedIn && me.isError && !me.data;
  const ready =
    splashTimeoutReached ||
    meFailed ||
    ((fontsLoaded || !!fontsError) && !authLoading && (!signedIn || onboarded !== null));

  // Effect rather than onLayout, which never fires if something throws before first paint.
  useEffect(() => {
    if (!ready) return;
    console.log("[boot] ready, hiding splash", {
      fontsLoaded,
      fontsError: fontsError?.message,
      authLoading,
      timedOut: splashTimeoutReached,
    });
    SplashScreen.hideAsync().catch((e) => {
      console.warn("[boot] hideAsync failed", e);
    });
  }, [ready, fontsLoaded, fontsError, authLoading, splashTimeoutReached]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <KeyboardProvider>
          {/* Default Phosphor weight + size for every icon in the app. Per
              design spec the regular weight is the only one we use; setting
              it here means individual call sites don't have to remember. */}
          <IconContext.Provider value={{ weight: "regular", size: 20 }}>
            <ReaderProvider>
              {meFailed ? (
                <ErrorState onRetry={() => void me.refetch()} />
              ) : (
                <Stack screenOptions={{ headerShown: false }} />
              )}
              <StatusBar style="auto" />
            </ReaderProvider>
          </IconContext.Provider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function App() {
  return (
    <FoxingDataProvider api={api} queryClient={queryClient}>
      <RootLayout />
    </FoxingDataProvider>
  );
}

export default Sentry.wrap(App);
