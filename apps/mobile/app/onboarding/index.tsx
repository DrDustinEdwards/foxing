import { useCallback, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native'
import { Screen } from '@/components/ui/screen'
import { Check, CaretLeft, CaretRight, BookOpen, X as XIcon } from 'phosphor-react-native'
import { errorMessage, keys, useApi, useOnboarding, useUsernameAvailable } from '@foxing/client'
import type { BookCard } from '@foxing/types'
import { useQueryClient } from '@tanstack/react-query'
import { authClient } from '@/lib/api'
import { Colors, useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// The profile is created on the last step, so a reader who quits halfway comes back to
// this flow (the root layout sends anyone signed in without a profile here).
type StepId = 'welcome' | 'profile' | 'taste' | 'first_book'
const STEP_ORDER: StepId[] = ['welcome', 'profile', 'taste', 'first_book']

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/

export default function OnboardingScreen() {
  const colors = useColors()
  const api = useApi()
  const qc = useQueryClient()
  const { data: session } = authClient.useSession()
  const onboarding = useOnboarding()
  const [step, setStep] = useState<StepId>('welcome')
  const idx = STEP_ORDER.indexOf(step)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Persisted draft across steps.
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState(session?.user?.name ?? '')
  const [genres, setGenres] = useState<Set<string>>(new Set())
  const [goalBooks, setGoalBooks] = useState<string>('12')
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const handle = username.trim().toLowerCase()
  const handleOk = USERNAME_RE.test(handle)
  const available = useUsernameAvailable(handle, handleOk)

  // One pass at the end: the profile, then the year goal and the picked books. The
  // root layout moves on to the tabs once "me" shows the profile.
  const finish = useCallback(
    async (save: boolean) => {
      setSubmitting(true)
      setError(null)
      try {
        await api.post('/me/onboard', {
          username: handle,
          displayName: displayName.trim() || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          favoriteGenres: save ? [...genres] : undefined,
        })
        const target = parseInt(goalBooks, 10)
        await Promise.all([
          save && isValidGoal(goalBooks)
            ? api.post('/goals', {
                type: 'books',
                target,
                periodType: 'year',
                year: new Date().getFullYear(),
              })
            : null,
          ...(save ? [...picked] : []).map((id) => api.put(`/library/${id}`, { status: 'want' })),
        ])
        await qc.invalidateQueries({ queryKey: keys.me })
      } catch (e) {
        setError(errorMessage(e))
        setSubmitting(false)
      }
    },
    [api, displayName, genres, goalBooks, handle, picked, qc],
  )

  const next = useCallback(async () => {
    const i = STEP_ORDER.indexOf(step)
    if (i === STEP_ORDER.length - 1) await finish(true)
    else setStep(STEP_ORDER[i + 1])
  }, [finish, step])

  const back = useCallback(() => {
    const i = STEP_ORDER.indexOf(step)
    if (i > 0) setStep(STEP_ORDER[i - 1])
  }, [step])

  const canAdvance =
    step === 'welcome' ||
    (step === 'profile' && handleOk && available === true) ||
    (step === 'taste' && genres.size >= 2 && isValidGoal(goalBooks)) ||
    step === 'first_book'

  if (step === 'welcome') {
    return <Welcome onStart={next} />
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
          <CaretLeft
            color={idx === 0 ? colors.borderSubtle : colors.textPrimary}
            size={20}
          />
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
        {step === 'profile' ? (
          <ProfileStep
            username={username}
            setUsername={setUsername}
            displayName={displayName}
            setDisplayName={setDisplayName}
            status={!handle ? null : !handleOk ? 'invalid' : available === null ? 'checking' : available ? 'available' : 'taken'}
          />
        ) : step === 'taste' ? (
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

      <View
        className="flex-row items-center justify-between px-4 py-3 border-t border-border-subtle-light dark:border-border-subtle-dark"
      >
        <Pressable
          onPress={() => {
            // Skip moves on without this step's picks; the profile itself is required.
            const i = STEP_ORDER.indexOf(step)
            if (i === STEP_ORDER.length - 1) void finish(false)
            else setStep(STEP_ORDER[i + 1])
          }}
          disabled={step === 'profile' || submitting}
          accessibilityRole="button"
          accessibilityLabel="Skip step"
          accessibilityState={{ disabled: step === 'profile' || submitting }}
          className="px-4 py-2"
          style={{ opacity: step === 'profile' ? 0 : 1 }}
        >
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textTertiary, fontSize: 13 }}>
            {step === 'first_book' ? 'Skip for now' : 'Skip'}
          </Text>
        </Pressable>
        <Pressable
          onPress={next}
          disabled={!canAdvance || submitting}
          accessibilityRole="button"
          accessibilityLabel={
            idx === STEP_ORDER.length - 1 ? 'Finish onboarding' : 'Continue to next step'
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
                {idx === STEP_ORDER.length - 1 ? 'Start reading' : 'Next'}
              </Text>
              {idx !== STEP_ORDER.length - 1 ? (
                <CaretRight color={colors.textOnBrand} size={14} weight="bold" />
              ) : null}
            </>
          )}
        </Pressable>
      </View>
    </Screen>
  )
}

function isValidGoal(value: string): boolean {
  const n = parseInt(value, 10)
  return Number.isFinite(n) && n >= 1 && n <= 200
}

// ── Welcome ──────────────────────────────────────────────────────────────

// Pinned-dark brand splash: dark-scheme tokens regardless of the system scheme.
const C = Colors.dark

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bgBase }}>
      <Screen style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text
          style={{
            fontFamily: Fonts.display,
            fontSize: 56,
            color: C.brandUi,
            marginBottom: 12,
            letterSpacing: -1,
          }}
        >
          Foxing
        </Text>
        <Text
          style={{
            fontFamily: Fonts.bodyItalic,
            fontSize: 18,
            color: C.textPrimary,
            marginBottom: 48,
            textAlign: 'center',
          }}
        >
          reading, together.
        </Text>
        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel="Start"
          style={{
            backgroundColor: C.brandUi,
            paddingHorizontal: 28,
            paddingVertical: 14,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: C.textOnBrand }}>
            Start
          </Text>
        </Pressable>
      </Screen>
    </View>
  )
}

// ── Taste (genres + reading goal) ────────────────────────────────────────

function TasteStep({
  genres,
  setGenres,
  options,
  goalBooks,
  setGoalBooks,
}: {
  genres: Set<string>
  setGenres: (s: Set<string>) => void
  options: string[]
  goalBooks: string
  setGoalBooks: (v: string) => void
}) {
  const colors = useColors()
  const year = new Date().getFullYear()
  return (
    <View>
      <Heading>What do you love to read?</Heading>
      <Sub>Pick at least two so we can tailor your feed.</Sub>
      <View className="flex-row flex-wrap" style={{ gap: 10 }}>
        {options.map((g) => {
          const active = genres.has(g)
          return (
            <Pressable
              key={g}
              onPress={() => {
                const next = new Set(genres)
                if (next.has(g)) next.delete(g)
                else next.add(g)
                setGenres(next)
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={g}
              className="flex-row items-center justify-center px-4 py-4 rounded-2xl border"
              style={{
                width: '47%',
                backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                borderColor: active ? colors.borderBrand : colors.borderSubtle,
              }}
            >
              {active ? <Check color={colors.brandText} size={14} weight="bold" /> : null}
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 13,
                  color: active ? colors.brandText : colors.textPrimary,
                  marginLeft: active ? 6 : 0,
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {g}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <View style={{ marginTop: 24 }}>
        <Heading>How many books do you want to read this year?</Heading>
        <Sub>Pick a number between 1 and 200. You can change it later.</Sub>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text style={{ fontFamily: Fonts.body, fontSize: 15, color: colors.textSecondary }}>
            I want to read
          </Text>
          <TextInput
            value={goalBooks}
            onChangeText={(t) => setGoalBooks(t.replace(/[^0-9]/g, '').slice(0, 3))}
            keyboardType="number-pad"
            maxLength={3}
            accessibilityLabel="Books per year goal"
            style={{
              fontFamily: Fonts.mono,
              fontSize: 18,
              color: colors.textPrimary,
              backgroundColor: colors.bgSurface,
              borderColor: isValidGoal(goalBooks) ? colors.borderInteractive : colors.error,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              minWidth: 70,
              textAlign: 'center',
            }}
          />
          <Text style={{ fontFamily: Fonts.body, fontSize: 15, color: colors.textSecondary }}>
            books in {year}
          </Text>
        </View>
      </View>
    </View>
  )
}

// ── Profile (username + display name) ────────────────────────────────────

function ProfileStep({
  username,
  setUsername,
  displayName,
  setDisplayName,
  status,
}: {
  username: string
  setUsername: (v: string) => void
  displayName: string
  setDisplayName: (v: string) => void
  status: 'invalid' | 'checking' | 'available' | 'taken' | null
}) {
  const colors = useColors()
  const input =
    'font-ui rounded-xl px-4 py-4 text-base bg-bg-surface-light dark:bg-bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-interactive-light dark:border-border-interactive-dark'
  const note =
    status === 'invalid'
      ? 'Use 3 to 30 lowercase letters, numbers, _ or -, not starting or ending with _ or -.'
      : status === 'checking'
        ? 'Checking...'
        : status === 'available'
          ? `${username.trim().toLowerCase()} is available`
          : status === 'taken'
            ? `${username.trim().toLowerCase()} is taken`
            : null
  return (
    <View>
      <Heading>Make your profile</Heading>
      <Sub>Your username is how other readers find you. You can change your display name later.</Sub>
      <View className="gap-4">
        <View className="gap-1">
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect={false}
            maxLength={30}
            accessibilityLabel="Username"
            className={input}
          />
          {note ? (
            <Text
              accessibilityLiveRegion="polite"
              className={`font-ui text-xs px-2 ${
                status === 'available'
                  ? 'text-success-light dark:text-success-dark'
                  : status === 'checking'
                    ? 'text-text-tertiary-light dark:text-text-tertiary-dark'
                    : 'text-error-light dark:text-error-dark'
              }`}
            >
              {note}
            </Text>
          ) : null}
        </View>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          placeholderTextColor={colors.textTertiary}
          maxLength={80}
          accessibilityLabel="Display name"
          className={input}
        />
      </View>
    </View>
  )
}

// ── First Book ───────────────────────────────────────────────────────────

function FirstBookStep({
  books,
  loading,
  picked,
  setPicked,
}: {
  books: BookCard[]
  loading: boolean
  picked: Set<string>
  setPicked: (s: Set<string>) => void
}) {
  const colors = useColors()
  return (
    <View>
      <Heading>Start with a great book</Heading>
      <Sub>Pick any that catch your eye, we'll add them to your Want to Read shelf.</Sub>
      {loading ? (
        <ActivityIndicator color={colors.brandUi} />
      ) : books.length === 0 ? (
        <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>
          No starter books right now. Skip ahead and find one in Discover.
        </Text>
      ) : (
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {books.map((b) => {
            const active = picked.has(b.id)
            return (
              <Pressable
                key={b.id}
                onPress={() => {
                  const next = new Set(picked)
                  if (next.has(b.id)) next.delete(b.id)
                  else next.add(b.id)
                  setPicked(next)
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${b.title} by ${b.author}`}
                className="rounded-xl border overflow-hidden"
                style={{
                  width: '47%',
                  backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                  borderColor: active ? colors.borderBrand : colors.borderSubtle,
                }}
              >
                <View
                  style={{
                    aspectRatio: 2 / 3,
                    backgroundColor: colors.bgSunken,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {b.coverUrl ? (
                    <Image
                      source={{ uri: b.coverUrl }}
                      style={{ width: '100%', height: '100%' }}
                      accessibilityRole="image"
                      accessibilityLabel={`${b.title} cover`}
                    />
                  ) : (
                    <BookOpen color={colors.textTertiary} size={22} />
                  )}
                </View>
                <View style={{ padding: 8 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 12,
                      color: colors.textPrimary,
                    }}
                    numberOfLines={2}
                  >
                    {b.title}
                  </Text>
                  <Text
                    style={{ fontFamily: Fonts.ui, fontSize: 10, color: colors.textTertiary }}
                    numberOfLines={1}
                  >
                    {b.author}
                  </Text>
                </View>
                {active ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: colors.brandUi,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check color={colors.textOnBrand} size={12} weight="bold" />
                  </View>
                ) : null}
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

// ── Reusable layout bits ─────────────────────────────────────────────────

function Heading({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <Text
      style={{
        fontFamily: Fonts.displayBold,
        fontSize: 24,
        color: colors.textPrimary,
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  )
}

function Sub({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <Text
      style={{
        fontFamily: Fonts.body,
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 20,
        lineHeight: 20,
      }}
    >
      {children}
    </Text>
  )
}
