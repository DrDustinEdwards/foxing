import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Screen } from "@/components/ui/screen";
import { CaretLeft, CaretRight, X as XIcon } from "phosphor-react-native";
import {
  failedRequestMessage,
  keys,
  useApi,
  useOnboarding,
  useUsernameAvailable,
} from "@foxing/client";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/api";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import {
  FirstBookStep,
  isValidGoal,
  ProfileStep,
  TasteStep,
  Welcome,
} from "@/components/onboarding/onboarding-steps";

type StepId = "welcome" | "profile" | "taste" | "first_book";
const STEP_ORDER: StepId[] = ["welcome", "profile", "taste", "first_book"];

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;

export default function OnboardingScreen() {
  const colors = useColors();
  const api = useApi();
  const qc = useQueryClient();
  const { data: session } = authClient.useSession();
  const onboarding = useOnboarding();
  const [step, setStep] = useState<StepId>("welcome");
  const idx = STEP_ORDER.indexOf(step);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(session?.user?.name ?? "");
  const [genres, setGenres] = useState<Set<string>>(new Set());
  const [goalBooks, setGoalBooks] = useState<string>("12");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const handle = username.trim().toLowerCase();
  const handleOk = USERNAME_RE.test(handle);
  const available = useUsernameAvailable(handle, handleOk);

  // One pass at the end: the profile first (a retry never meets "Already onboarded"), then
  // the goal and picked books, best-effort. Skipped steps are cleared, so only what is set is sent.
  const finish = useCallback(
    async (save: boolean) => {
      setSubmitting(true);
      setError(null);
      try {
        await api.post("/me/onboard", {
          username: handle,
          displayName: displayName.trim() || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          favoriteGenres: genres.size > 0 ? [...genres] : undefined,
        });
        const target = parseInt(goalBooks, 10);
        await Promise.allSettled([
          isValidGoal(goalBooks)
            ? api.post("/goals", {
                type: "books",
                target,
                periodType: "year",
                year: new Date().getFullYear(),
              })
            : null,
          ...(save ? [...picked] : []).map((id) => api.put(`/library/${id}`, { status: "want" })),
        ]);
        await qc.invalidateQueries({ queryKey: keys.me });
      } catch (e) {
        setError(failedRequestMessage(e));
        setSubmitting(false);
      }
    },
    [api, displayName, genres, goalBooks, handle, picked, qc],
  );

  const next = useCallback(async () => {
    if (idx === STEP_ORDER.length - 1) await finish(true);
    else setStep(STEP_ORDER[idx + 1]);
  }, [finish, idx]);

  const back = useCallback(() => {
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  }, [idx]);

  const canAdvance =
    step === "welcome" ||
    (step === "profile" && handleOk && available === true) ||
    (step === "taste" && genres.size >= 2 && isValidGoal(goalBooks)) ||
    step === "first_book";

  if (step === "welcome") {
    return <Welcome onStart={() => void next()} />;
  }

  return (
    <Screen>
      <View className="flex-row items-center justify-between px-3 py-2">
        <Pressable
          onPress={back}
          hitSlop={10}
          className="p-2"
          disabled={idx === 0}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <CaretLeft color={idx === 0 ? colors.borderSubtle : colors.textPrimary} size={20} />
        </Pressable>
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textTertiary }}>
          {idx + 1} of {STEP_ORDER.length}
        </Text>
        <View style={{ width: 36 }} />
      </View>
      <View className="flex-row gap-1 px-4 mb-3">
        {STEP_ORDER.map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i <= idx ? colors.brandUi : colors.borderSubtle,
            }}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {step === "profile" ? (
          <ProfileStep
            username={username}
            setUsername={setUsername}
            displayName={displayName}
            setDisplayName={setDisplayName}
            status={
              !handle
                ? null
                : !handleOk
                  ? "invalid"
                  : available === null
                    ? "checking"
                    : available
                      ? "available"
                      : "taken"
            }
          />
        ) : step === "taste" ? (
          <TasteStep
            genres={genres}
            setGenres={setGenres}
            options={(onboarding.data?.genres ?? []).map((g) => g.subject)}
            goalBooks={goalBooks}
            setGoalBooks={setGoalBooks}
          />
        ) : (
          <FirstBookStep
            books={onboarding.data?.starters ?? []}
            loading={onboarding.isPending}
            picked={picked}
            setPicked={setPicked}
          />
        )}
        {error ? (
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            className="flex-row items-center gap-2 rounded-lg px-3 py-2 mt-4 bg-error-bg-light dark:bg-error-bg-dark"
          >
            <XIcon color={colors.error} size={16} />
            <Text className="font-ui text-error-light dark:text-error-dark flex-1">{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View className="flex-row items-center justify-between px-4 py-3 border-t border-border-subtle-light dark:border-border-subtle-dark">
        <Pressable
          onPress={() => {
            if (step === "taste") {
              setGenres(new Set());
              setGoalBooks("");
            }
            if (idx === STEP_ORDER.length - 1) void finish(false);
            else setStep(STEP_ORDER[idx + 1]);
          }}
          disabled={step === "profile" || submitting}
          accessibilityRole="button"
          accessibilityLabel="Skip step"
          accessibilityState={{ disabled: step === "profile" || submitting }}
          className="px-4 py-2"
          style={{ opacity: step === "profile" ? 0 : 1 }}
        >
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textTertiary, fontSize: 13 }}>
            {step === "first_book" ? "Skip for now" : "Skip"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void next()}
          disabled={!canAdvance || submitting}
          accessibilityRole="button"
          accessibilityLabel={
            idx === STEP_ORDER.length - 1 ? "Finish onboarding" : "Continue to next step"
          }
          accessibilityState={{ disabled: !canAdvance || submitting, busy: submitting }}
          className="flex-row items-center gap-1 px-5 py-2 rounded-full"
          style={{
            backgroundColor: canAdvance ? colors.brandUi : colors.bgDisabled,
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textOnBrand} size="small" />
          ) : (
            <>
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                {idx === STEP_ORDER.length - 1 ? "Start reading" : "Next"}
              </Text>
              {idx !== STEP_ORDER.length - 1 ? (
                <CaretRight color={colors.textOnBrand} size={14} weight="bold" />
              ) : null}
            </>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}
