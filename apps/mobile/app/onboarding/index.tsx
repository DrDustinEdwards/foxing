import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Check, CaretLeft, CaretRight, BookOpen } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { reportWriteError } from '@/lib/db-write'
import { Colors, useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// Onboarding key, _layout reads this on launch and routes here if missing.
export const ONBOARDING_KEY = 'onboarding_complete'

type StepId = 'welcome' | 'taste' | 'first_book'
const STEP_ORDER: StepId[] = ['welcome', 'taste', 'first_book']

const GENRES = [
  'Classic Literature',
  'Mystery & Crime',
  'Science Fiction',
  'Gothic Horror',
  'Romance',
  'Adventure',
  'Philosophy',
  'Poetry',
  'Historical Fiction',
  'Short Stories',
]

// Hardcoded starter library, title-matched against the catalog so missing
// titles simply don't render. Each one is a well-known public-domain work.
const STARTER_TITLES = [
  'Frankenstein; Or, The Modern Prometheus',
  'Frankenstein',
  'Dracula',
  'The Picture of Dorian Gray',
  'The Adventures of Sherlock Holmes',
  'Pride and Prejudice',
  'Moby Dick; Or, The Whale',
  'Moby-Dick; Or, The Whale',
]

interface StarterBook {
  id: string
  title: string
  author: string
  cover_url: string | null
}

export default function OnboardingScreen() {
  const colors = useColors()
  const router = useRouter()
  const [step, setStep] = useState<StepId>('welcome')
  const idx = STEP_ORDER.indexOf(step)
  const [submitting, setSubmitting] = useState(false)

  // Persisted draft across steps.
  const [genres, setGenres] = useState<Set<string>>(new Set())
  // Goal merged into the Taste step per Section 3c. Number, 1-200 books.
  const [goalBooks, setGoalBooks] = useState<string>('12')
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const next = useCallback(async () => {
    if (step === 'taste') {
      await persistGenres(genres)
      await persistGoal(goalBooks)
    }
    if (step === 'first_book') await persistStarterBooks(picked)
    const i = STEP_ORDER.indexOf(step)
    if (i === STEP_ORDER.length - 1) {
      setSubmitting(true)
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
      router.replace('/(tabs)' as never)
    } else {
      setStep(STEP_ORDER[i + 1])
    }
  }, [genres, goalBooks, picked, router, step])

  const back = useCallback(() => {
    const i = STEP_ORDER.indexOf(step)
    if (i > 0) setStep(STEP_ORDER[i - 1])
  }, [step])

  const canAdvance =
    step === 'welcome' ||
    (step === 'taste' && genres.size >= 2 && isValidGoal(goalBooks)) ||
    step === 'first_book'

  if (step === 'welcome') {
    return <Welcome onStart={next} />
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
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
        {step === 'taste' ? (
          <TasteStep
            genres={genres}
            setGenres={setGenres}
            goalBooks={goalBooks}
            setGoalBooks={setGoalBooks}
          />
        ) : (
          <FirstBookStep picked={picked} setPicked={setPicked} />
        )}
      </ScrollView>

      <View
        className="flex-row items-center justify-between px-4 py-3 border-t border-border-subtle-light dark:border-border-subtle-dark"
      >
        <Pressable
          onPress={async () => {
            // Skip = finish onboarding without saving the current step's data.
            const i = STEP_ORDER.indexOf(step)
            if (i === STEP_ORDER.length - 1) {
              await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
              router.replace('/(tabs)' as never)
            } else {
              setStep(STEP_ORDER[i + 1])
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Skip step"
          className="px-4 py-2"
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
    </SafeAreaView>
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
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
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
      </SafeAreaView>
    </View>
  )
}

// ── Taste (genres + reading goal) ────────────────────────────────────────

function TasteStep({
  genres,
  setGenres,
  goalBooks,
  setGoalBooks,
}: {
  genres: Set<string>
  setGenres: (s: Set<string>) => void
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
        {GENRES.map((g) => {
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

// ── First Book ───────────────────────────────────────────────────────────

function FirstBookStep({
  picked,
  setPicked,
}: {
  picked: Set<string>
  setPicked: (s: Set<string>) => void
}) {
  const colors = useColors()
  const [books, setBooks] = useState<StarterBook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase
        .from('books')
        .select('id, title, author, cover_url')
        .in('title', STARTER_TITLES)
        .limit(6)
      if (!mounted) return
      setBooks(((data ?? []) as StarterBook[]).slice(0, 6))
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <View>
      <Heading>Start with a great book</Heading>
      <Sub>Pick any that catch your eye, we'll add them to your Want to Read shelf.</Sub>
      {loading ? (
        <ActivityIndicator color={colors.brandUi} />
      ) : books.length === 0 ? (
        <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>
          The starter catalog isn't ingested yet, skip ahead and discover books later.
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
                  {b.cover_url ? (
                    <Image
                      source={{ uri: b.cover_url }}
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

// ── Persistence helpers ──────────────────────────────────────────────────

async function persistGenres(genres: Set<string>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('profiles')
    .update({ favorite_genres: [...genres] })
    .eq('id', user.id)
}

async function persistGoal(goalBooks: string) {
  const target = parseInt(goalBooks, 10)
  if (!Number.isFinite(target) || target < 1 || target > 200) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const year = new Date().getFullYear()
  // New schema uses type='books_per_year' per task.md Section 1f. Older rows
  // with type='books_year' coexist; the upsert key includes type so they
  // don't collide.
  const { error } = await supabase.from('reading_goals').upsert(
    { user_id: user.id, year, type: 'books_per_year', target },
    { onConflict: 'user_id,year,type' },
  )
  reportWriteError(error, { op: 'upsert', table: 'reading_goals' })
}

async function persistStarterBooks(picked: Set<string>) {
  if (picked.size === 0) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const rows = [...picked].map((book_id) => ({
    user_id: user.id,
    book_id,
    status: 'want_to_read' as const,
  }))
  const { error } = await supabase.from('user_books').upsert(rows, { onConflict: 'user_id,book_id' })
  reportWriteError(error, { op: 'upsert', table: 'user_books', extra: { count: rows.length } })
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
