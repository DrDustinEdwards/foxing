import { useCallback, useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X as XIcon, CaretLeft, CaretRight, Check, BookOpen } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  type ClubBook,
  type ClubPace,
  type Club,
  PACE_OPTIONS,
  createClub,
  searchBooks,
} from '@/lib/clubs'

type Step = 'basics' | 'book' | 'pace' | 'invite'
const STEP_ORDER: Step[] = ['basics', 'book', 'pace', 'invite']

interface DraftState {
  name: string
  description: string
  isPublic: boolean
  book: ClubBook | null
  pace: ClubPace
}

const EMPTY_DRAFT: DraftState = {
  name: '',
  description: '',
  isPublic: true,
  book: null,
  pace: 'chill',
}

interface CreateClubSheetProps {
  visible: boolean
  onClose: () => void
  onCreated?: (club: Club) => void
}

export function CreateClubSheet({ visible, onClose, onCreated }: CreateClubSheetProps) {
  const colors = useColors()
  const [step, setStep] = useState<Step>('basics')
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<Club | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset state every time the sheet (re)opens, a previous half-finished
  // draft shouldn't leak into a brand-new flow.
  useEffect(() => {
    if (visible) {
      setStep('basics')
      setDraft(EMPTY_DRAFT)
      setSubmitting(false)
      setCreated(null)
      setError(null)
    }
  }, [visible])

  const idx = STEP_ORDER.indexOf(step)
  const isLast = step === 'invite'
  const canAdvance =
    step === 'basics' ? draft.name.trim().length >= 2 : true

  const goNext = useCallback(async () => {
    if (step === 'pace') {
      // Commit on transition into the Invite step so the user lands on the
      // "created" confirmation with the real club row in hand.
      setSubmitting(true)
      setError(null)
      const club = await createClub({
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        current_book_id: draft.book?.id ?? null,
        pace: draft.pace,
        is_public: draft.isPublic,
      })
      setSubmitting(false)
      if (!club) {
        setError("Couldn't create the club. Check your schema/RLS and try again.")
        return
      }
      setCreated(club)
      setStep('invite')
      return
    }
    if (isLast) {
      if (created) onCreated?.(created)
      onClose()
      return
    }
    setStep(STEP_ORDER[idx + 1])
  }, [created, draft, idx, isLast, onClose, onCreated, step])

  const goBack = useCallback(() => {
    if (idx === 0) {
      onClose()
      return
    }
    setStep(STEP_ORDER[idx - 1])
  }, [idx, onClose])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark" edges={['top']}>
        <View className="flex-row items-center justify-between px-3 py-2">
          <Pressable onPress={goBack} hitSlop={10} className="p-2 flex-row items-center">
            {idx === 0 ? (
              <XIcon color={colors.textPrimary} size={20} />
            ) : (
              <CaretLeft color={colors.textPrimary} size={20} />
            )}
          </Pressable>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}>
            New Club · {idx + 1}/{STEP_ORDER.length}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <StepBar count={STEP_ORDER.length} index={idx} />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          >
            {step === 'basics' ? (
              <BasicsStep draft={draft} setDraft={setDraft} />
            ) : step === 'book' ? (
              <BookStep draft={draft} setDraft={setDraft} />
            ) : step === 'pace' ? (
              <PaceStep draft={draft} setDraft={setDraft} />
            ) : (
              <InviteStep club={created} />
            )}
            {error ? (
              <View
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.errorBg,
                }}
              >
                <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.error }}>
                  {error}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>

        <View
          className="flex-row items-center justify-between px-4 py-3 border-t border-border-subtle-light dark:border-border-subtle-dark"
        >
          <Pressable
            onPress={goBack}
            className="px-4 py-2 rounded-full"
            style={{ opacity: idx === 0 ? 0 : 1 }}
            disabled={idx === 0}
            accessibilityLabel="Back"
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textSecondary }}>Back</Text>
          </Pressable>
          <Pressable
            onPress={goNext}
            disabled={!canAdvance || submitting}
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
                  {isLast ? 'Done' : step === 'pace' ? 'Create' : 'Continue'}
                </Text>
                {!isLast ? <CaretRight color={colors.textOnBrand} size={14} weight="bold" /> : null}
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

// ── Step bar ─────────────────────────────────────────────────────────────

function StepBar({ count, index }: { count: number; index: number }) {
  const colors = useColors()
  return (
    <View className="flex-row gap-1 px-4 mb-2">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            backgroundColor: i <= index ? colors.brandUi : colors.borderSubtle,
          }}
        />
      ))}
    </View>
  )
}

// ── Basics ───────────────────────────────────────────────────────────────

function BasicsStep({
  draft,
  setDraft,
}: {
  draft: DraftState
  setDraft: (next: DraftState) => void
}) {
  const colors = useColors()
  return (
    <View>
      <StepTitle>The basics</StepTitle>
      <StepHint>Name your club and write a short pitch.</StepHint>

      <Label>Name</Label>
      <TextInput
        value={draft.name}
        onChangeText={(t) => setDraft({ ...draft, name: t })}
        placeholder="The Wuthering Heights Society"
        placeholderTextColor={colors.textTertiary}
        maxLength={60}
        style={inputStyle(colors)}
      />

      <Label>Description (optional)</Label>
      <TextInput
        value={draft.description}
        onChangeText={(t) => setDraft({ ...draft, description: t })}
        placeholder="What is this club about? Who is it for?"
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={4}
        maxLength={400}
        style={{ ...inputStyle(colors), height: 110, textAlignVertical: 'top' }}
      />

      <View
        className="flex-row items-center justify-between mt-4 p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
            Public club
          </Text>
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 12,
              color: colors.textTertiary,
              marginTop: 2,
            }}
          >
            Anyone can find and join. Turn off to make membership invite-only.
          </Text>
        </View>
        <Switch
          value={draft.isPublic}
          onValueChange={(v) => setDraft({ ...draft, isPublic: v })}
          trackColor={{ false: colors.bgDisabled, true: colors.brandUi }}
        />
      </View>
    </View>
  )
}

// ── Current book ────────────────────────────────────────────────────────

function BookStep({
  draft,
  setDraft,
}: {
  draft: DraftState
  setDraft: (next: DraftState) => void
}) {
  const colors = useColors()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClubBook[]>([])
  const [busy, setBusy] = useState(false)

  // Lightweight debounce, search after the user pauses typing.
  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([])
        return
      }
      setBusy(true)
      const rows = await searchBooks(query)
      setBusy(false)
      setResults(rows)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  return (
    <View>
      <StepTitle>What are you reading?</StepTitle>
      <StepHint>Optional, you can also start without a book and pick one later.</StepHint>

      {draft.book ? (
        <View
          className="flex-row p-3 rounded-xl border bg-bg-selected-light dark:bg-bg-selected-dark border-border-brand-light dark:border-border-brand-dark"
        >
          <BookCover book={draft.book} />
          <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}
              numberOfLines={2}
            >
              {draft.book.title}
            </Text>
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 12,
                color: colors.textTertiary,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {draft.book.author}
            </Text>
          </View>
          <Pressable
            onPress={() => setDraft({ ...draft, book: null })}
            hitSlop={8}
            style={{ padding: 6 }}
            accessibilityLabel="Clear book"
          >
            <XIcon color={colors.textSecondary} size={18} />
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search a title…"
            placeholderTextColor={colors.textTertiary}
            style={inputStyle(colors)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {busy ? (
            <View style={{ padding: 12, alignItems: 'center' }}>
              <ActivityIndicator color={colors.brandUi} />
            </View>
          ) : null}
          {results.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setDraft({ ...draft, book: b })}
              className="flex-row mt-2 p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <BookCover book={b} />
              <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
                <Text
                  style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
                  numberOfLines={2}
                >
                  {b.title}
                </Text>
                <Text
                  style={{
                    fontFamily: Fonts.ui,
                    fontSize: 12,
                    color: colors.textTertiary,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {b.author}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      )}
    </View>
  )
}

function BookCover({ book }: { book: ClubBook }) {
  const colors = useColors()
  return (
    <View
      style={{
        width: 40,
        height: 60,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: colors.bgSunken,
      }}
    >
      {book.cover_url ? (
        <Image source={{ uri: book.cover_url }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <BookOpen color={colors.textTertiary} size={16} />
        </View>
      )}
    </View>
  )
}

// ── Pace ────────────────────────────────────────────────────────────────

function PaceStep({
  draft,
  setDraft,
}: {
  draft: DraftState
  setDraft: (next: DraftState) => void
}) {
  const colors = useColors()
  return (
    <View>
      <StepTitle>Reading pace</StepTitle>
      <StepHint>Sets expectations, you can change it any time.</StepHint>

      {PACE_OPTIONS.map((p) => {
        const selected = draft.pace === p.id
        return (
          <Pressable
            key={p.id}
            onPress={() => setDraft({ ...draft, pace: p.id })}
            className="flex-row items-center p-4 mb-2 rounded-xl border"
            style={{
              backgroundColor: selected ? colors.bgSelected : colors.bgSurface,
              borderColor: selected ? colors.borderBrand : colors.borderSubtle,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}>
                {p.label}
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 12,
                  color: colors.textTertiary,
                  marginTop: 2,
                }}
              >
                {p.subtitle}
              </Text>
            </View>
            {selected ? <Check color={colors.brandUi} size={18} weight="bold" /> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

// ── Invite ──────────────────────────────────────────────────────────────

function InviteStep({ club }: { club: Club | null }) {
  const colors = useColors()
  if (!club) {
    return (
      <View>
        <StepTitle>Almost there…</StepTitle>
        <StepHint>Tap Create on the previous step to finish.</StepHint>
      </View>
    )
  }
  return (
    <View>
      <StepTitle>You're in</StepTitle>
      <StepHint>
        {club.name} is live. {club.is_public ? 'Anyone can find and join.' : 'Share the link to invite readers.'}
      </StepHint>

      <View
        className="p-4 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textTertiary }}>
          Club link
        </Text>
        <Text
          selectable
          style={{
            fontFamily: Fonts.mono,
            fontSize: 13,
            color: colors.textPrimary,
            marginTop: 6,
          }}
        >
          foxing://clubs/{club.id}
        </Text>
      </View>
    </View>
  )
}

// ── Reusable bits ────────────────────────────────────────────────────────

function StepTitle({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <Text
      style={{
        fontFamily: Fonts.displayBold,
        fontSize: 22,
        color: colors.textPrimary,
        marginBottom: 4,
      }}
    >
      {children}
    </Text>
  )
}

function StepHint({ children }: { children: React.ReactNode }) {
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

function Label({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <Text
      style={{
        fontFamily: Fonts.uiMedium,
        fontSize: 12,
        color: colors.textTertiary,
        marginTop: 16,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}
    >
      {children}
    </Text>
  )
}

function inputStyle(colors: ReturnType<typeof useColors>) {
  return {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as const
}
