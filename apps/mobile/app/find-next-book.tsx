import { useCallback, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { Screen } from '@/components/ui/screen'
import { useRouter } from 'expo-router'
import { CaretLeft, Sparkle } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { friendlyAiError } from '@/lib/claude'

// 3-step mood/length/era picker that drives an AI recommendation call.
// Renamed from "mood quiz" per the language cleanup pass, the screen now
// answers "What are you in the mood for?" rather than presenting itself
// as a quiz.

const MOODS = [
  'Dark',
  'Uplifting',
  'Funny',
  'Tense',
  'Romantic',
  'Adventurous',
  'Reflective',
  'Mysterious',
] as const

const LENGTHS: Array<{ id: 'short' | 'medium' | 'long'; label: string; sub: string }> = [
  { id: 'short', label: 'Short', sub: 'Under 2 hours' },
  { id: 'medium', label: 'Medium', sub: '2-5 hours' },
  { id: 'long', label: 'Long', sub: '5+ hours' },
]

const ERAS: Array<{ id: string; label: string }> = [
  { id: 'any', label: 'Anytime' },
  { id: 'pre1900', label: 'Pre-1900' },
  { id: '1900-1950', label: '1900-1950' },
  { id: '1950-2000', label: '1950-2000' },
]

interface Recommendation {
  title: string
  author: string
  reason: string
  bookId?: string | null
}

export default function FindNextBookScreen() {
  const colors = useColors()
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [mood, setMood] = useState<string | null>(null)
  const [length, setLength] = useState<'short' | 'medium' | 'long' | null>(null)
  const [era, setEra] = useState<string>('any')
  const [busy, setBusy] = useState(false)
  const [recs, setRecs] = useState<Recommendation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchRecs = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.functions.invoke('ai-companion', {
        body: {
          action: 'recommendations',
          payload: { mood, length, era },
        },
      })
      if (err) {
        setError(friendlyAiError(err))
        return
      }
      if (data?.error) {
        setError(friendlyAiError(new Error(data.error)))
        return
      }
      const raw = (data?.result ?? '').trim()
      // The Edge Function returns JSON for this action; tolerate both fenced
      // and bare output by stripping a leading/trailing ``` block if present.
      const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      let parsed: { recommendations?: Recommendation[] } | null = null
      try {
        parsed = JSON.parse(stripped) as { recommendations?: Recommendation[] }
      } catch {
        setError("Couldn't read that, try again.")
        return
      }
      setRecs(parsed?.recommendations ?? [])
      setStep(4)
    } catch (e) {
      setError(friendlyAiError(e))
    } finally {
      setBusy(false)
    }
  }, [era, length, mood])

  const addToWantToRead = useCallback(async (r: Recommendation) => {
    if (!r.bookId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('user_books').upsert(
      { user_id: user.id, book_id: r.bookId, status: 'want_to_read' },
      { onConflict: 'user_id,book_id' },
    )
  }, [])

  return (
    <Screen>
      <View className="flex-row items-center px-3 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="p-2"
        >
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 18,
            color: colors.textPrimary,
            marginLeft: 4,
          }}
        >
          Find Your Next Book
        </Text>
      </View>

      {step === 4 ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 10,
            }}
          >
            For you
          </Text>
          {error ? (
            <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.error, marginBottom: 12 }}>
              {error}
            </Text>
          ) : null}
          {(recs ?? []).length === 0 ? (
            <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textTertiary }}>
              Nothing came back. Tweak your picks and try again.
            </Text>
          ) : (
            (recs ?? []).map((r) => (
              <View
                key={`${r.title}:${r.author}`}
                className="p-3 mb-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              >
                <Text
                  style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}
                >
                  {r.title}
                </Text>
                <Text
                  style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}
                >
                  {r.author}
                </Text>
                <Text
                  style={{
                    fontFamily: Fonts.bodyItalic,
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginTop: 8,
                    lineHeight: 19,
                  }}
                >
                  {r.reason}
                </Text>
                <View className="flex-row items-center justify-end" style={{ marginTop: 10, gap: 10 }}>
                  {r.bookId ? (
                    <>
                      <Pressable
                        onPress={() => addToWantToRead(r)}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${r.title} to Want to Read`}
                        className="px-3 py-1 rounded-full border"
                        style={{ borderColor: colors.borderInteractive }}
                      >
                        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textPrimary }}>
                          Add to Want to Read
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => router.push(`/book/${r.bookId}` as never)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${r.title}`}
                        className="px-3 py-1 rounded-full"
                        style={{ backgroundColor: colors.brandUi }}
                      >
                        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textOnBrand }}>
                          Open
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </View>
            ))
          )}
          <Pressable
            onPress={() => {
              setStep(1)
              setRecs(null)
            }}
            accessibilityRole="button"
            accessibilityLabel="Start over"
            className="mt-3 p-3 rounded-xl border items-center"
            style={{ borderColor: colors.borderInteractive }}
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary }}>
              Start over
            </Text>
          </Pressable>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {/* Step progress */}
          <View className="flex-row gap-1 mb-6">
            {[1, 2, 3].map((p) => (
              <View
                key={p}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: p <= step ? colors.brandUi : colors.borderSubtle,
                }}
              />
            ))}
          </View>

          {step === 1 ? (
            <>
              <Heading colors={colors}>What are you in the mood for?</Heading>
              <Sub colors={colors}>Pick the vibe that fits where your head is at.</Sub>
              <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                {MOODS.map((m) => {
                  const active = mood === m
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setMood(active ? null : m)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={m}
                      className="px-4 py-3 rounded-2xl border"
                      style={{
                        width: '47%',
                        backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                        borderColor: active ? colors.borderBrand : colors.borderSubtle,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: Fonts.uiMedium,
                          fontSize: 14,
                          color: active ? colors.brandText : colors.textPrimary,
                          textAlign: 'center',
                        }}
                      >
                        {m}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </>
          ) : step === 2 ? (
            <>
              <Heading colors={colors}>How much time do you have?</Heading>
              <Sub colors={colors}>Roughly, we'll match book length to fit.</Sub>
              {LENGTHS.map((l) => {
                const active = length === l.id
                return (
                  <Pressable
                    key={l.id}
                    onPress={() => setLength(l.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${l.label}, ${l.sub}`}
                    className="p-4 mb-2 rounded-2xl border"
                    style={{
                      backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                      borderColor: active ? colors.borderBrand : colors.borderSubtle,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 15,
                        color: active ? colors.brandText : colors.textPrimary,
                      }}
                    >
                      {l.label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: Fonts.ui,
                        fontSize: 12,
                        color: colors.textTertiary,
                        marginTop: 2,
                      }}
                    >
                      {l.sub}
                    </Text>
                  </Pressable>
                )
              })}
            </>
          ) : (
            <>
              <Heading colors={colors}>Era preference?</Heading>
              <Sub colors={colors}>Any era works, pick a window if you have one in mind.</Sub>
              {ERAS.map((e) => {
                const active = era === e.id
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => setEra(e.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={e.label}
                    className="p-4 mb-2 rounded-2xl border"
                    style={{
                      backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                      borderColor: active ? colors.borderBrand : colors.borderSubtle,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 15,
                        color: active ? colors.brandText : colors.textPrimary,
                      }}
                    >
                      {e.label}
                    </Text>
                  </Pressable>
                )
              })}
            </>
          )}
        </ScrollView>
      )}

      {step !== 4 ? (
        <View
          className="flex-row items-center justify-between px-4 py-3 border-t border-border-subtle-light dark:border-border-subtle-dark"
        >
          <Pressable
            onPress={() => {
              if (step === 1) router.back()
              else setStep(((step - 1) as 1 | 2 | 3))
            }}
            accessibilityRole="button"
            accessibilityLabel={step === 1 ? 'Cancel' : 'Back'}
            className="px-4 py-2"
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textTertiary, fontSize: 13 }}>
              {step === 1 ? 'Cancel' : 'Back'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (step === 1) {
                if (!mood) return
                setStep(2)
              } else if (step === 2) {
                if (!length) return
                setStep(3)
              } else if (step === 3) {
                fetchRecs()
              }
            }}
            disabled={
              busy ||
              (step === 1 && !mood) ||
              (step === 2 && !length)
            }
            accessibilityRole="button"
            accessibilityLabel={step === 3 ? 'Find books' : 'Next step'}
            className="flex-row items-center gap-2 px-5 py-2 rounded-full"
            style={{
              backgroundColor:
                (step === 1 && mood) || (step === 2 && length) || step === 3
                  ? colors.brandUi
                  : colors.bgDisabled,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.textOnBrand} size="small" />
            ) : (
              <>
                {step === 3 ? <Sparkle color={colors.textOnBrand} size={14} /> : null}
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                  {step === 3 ? 'Find books' : 'Next'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </Screen>
  )
}

function Heading({ children, colors }: { children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return (
    <Text
      style={{
        fontFamily: Fonts.displayBold,
        fontSize: 22,
        color: colors.textPrimary,
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  )
}

function Sub({ children, colors }: { children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return (
    <Text
      style={{
        fontFamily: Fonts.body,
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 18,
        lineHeight: 20,
      }}
    >
      {children}
    </Text>
  )
}
