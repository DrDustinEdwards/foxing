import { useEffect, useState } from 'react'
import {
  View, Text, Pressable, ScrollView, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface VocabRow {
  id: string
  word: string
  definition: string | null
  ai_context: string | null
  context: string | null
  context_sentence: string | null
  book_title: string | null
  book_id: string | null
  mastered: boolean
  looked_up_at: string | null
  created_at: string
}

export default function VocabularyScreen() {
  const colors = useColors()
  const router = useRouter()
  const { bookId } = useLocalSearchParams<{ bookId?: string }>()

  const [rows, setRows] = useState<VocabRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [bookFilter, setBookFilter] = useState<string | null>(bookId ?? null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [flashMode, setFlashMode] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      let query = supabase
        .from('vocabulary')
        .select('id, word, definition, ai_context, context, context_sentence, book_title, book_id, mastered, looked_up_at, created_at')
        .order('looked_up_at', { ascending: false, nullsFirst: false })
      if (bookFilter) query = query.eq('book_id', bookFilter)
      const { data, error: err } = await query
      if (cancelled) return
      if (err) setError(err.message)
      else setRows((data ?? []) as VocabRow[])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [bookFilter])

  const filtered = filter
    ? rows.filter((r) => r.word.toLowerCase().includes(filter.toLowerCase()))
    : rows
  const masteredCount = rows.filter((r) => r.mastered).length

  // ── Render ──────────────────────────────────────────────────────────

  if (flashMode) {
    return (
      <FlashcardMode
        rows={filtered.filter((r) => !r.mastered)}
        masteredCount={masteredCount}
        total={rows.length}
        onMaster={async (id) => {
          await supabase.from('vocabulary').update({ mastered: true }).eq('id', id)
          setRows((prev) => prev.map((r) => (r.id === id ? { ...r, mastered: true } : r)))
        }}
        onExit={() => setFlashMode(false)}
      />
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText, fontSize: 16 }}>
            ← Back
          </Text>
        </Pressable>
        <Text
          style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary }}
        >
          Vocabulary
        </Text>
        <Pressable
          onPress={() => setFlashMode(true)}
          disabled={rows.length === 0}
          style={{ opacity: rows.length === 0 ? 0.4 : 1 }}
        >
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText, fontSize: 14 }}>
            Flashcards
          </Text>
        </Pressable>
      </View>

      <View className="px-5 mb-3">
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Search your words…"
          placeholderTextColor={colors.textTertiary}
          className="rounded-xl px-4 py-3 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark text-text-primary-light dark:text-text-primary-dark"
          style={{ fontFamily: Fonts.ui, fontSize: 14 }}
        />
        {rows.length > 0 && (
          <Text
            style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: 6 }}
          >
            {masteredCount} of {rows.length} words mastered
          </Text>
        )}
        {bookFilter && (
          <Pressable onPress={() => setBookFilter(null)}>
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText, fontSize: 12, marginTop: 6 }}>
              Showing one book — tap to see all
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        {loading ? (
          <View className="py-16 items-center">
            <ActivityIndicator color={colors.brandUi} />
          </View>
        ) : error ? (
          <View className="rounded-xl p-3 flex-row gap-2 items-start bg-error-bg-light dark:bg-error-bg-dark">
            <Text style={{ color: colors.error }}>✕</Text>
            <Text style={{ fontFamily: Fonts.ui, color: colors.error, flex: 1 }}>{error}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <Text
            style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textTertiary, textAlign: 'center', marginTop: 32 }}
          >
            {rows.length === 0
              ? 'No words yet. Tap any word in your reading to add it here.'
              : 'No matches.'}
          </Text>
        ) : (
          filtered.map((r) => {
            const expanded = expandedId === r.id
            const sentence = r.context_sentence || r.context || ''
            return (
              <Pressable
                key={r.id}
                onPress={() => setExpandedId(expanded ? null : r.id)}
                className="mb-3 rounded-2xl p-4 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              >
                <View className="flex-row items-baseline justify-between">
                  <Text
                    style={{ fontFamily: Fonts.display, fontSize: 22, color: colors.textPrimary, flex: 1 }}
                    numberOfLines={1}
                  >
                    {r.word}
                  </Text>
                  {r.mastered && (
                    <Text
                      style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.success, marginLeft: 8 }}
                    >
                      ✓ Mastered
                    </Text>
                  )}
                </View>
                {r.book_title ? (
                  <Text
                    style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {r.book_title}
                  </Text>
                ) : null}
                <Text
                  style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 8 }}
                  numberOfLines={expanded ? undefined : 2}
                >
                  {r.definition || '(no definition yet)'}
                </Text>
                {expanded && sentence ? (
                  <View className="mt-3 pt-3 border-t border-border-subtle-light dark:border-border-subtle-dark">
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textTertiary,
                        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
                      }}
                    >
                      In context
                    </Text>
                    <Text
                      style={{ fontFamily: Fonts.bodyItalic, fontSize: 13, color: colors.textSecondary }}
                    >
                      “{sentence}”
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Flashcard mode ────────────────────────────────────────────────────

interface FlashcardProps {
  rows: VocabRow[]
  masteredCount: number
  total: number
  onMaster: (id: string) => Promise<void>
  onExit: () => void
}

function FlashcardMode({ rows, masteredCount, total, onMaster, onExit }: FlashcardProps) {
  const colors = useColors()
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [usage, setUsage] = useState('')

  const card = rows[idx]
  const done = !card

  function next() {
    setFlipped(false)
    setUsage('')
    setIdx((i) => i + 1)
  }

  async function markMastered() {
    if (!card) return
    await onMaster(card.id)
    next()
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable onPress={onExit}>
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText, fontSize: 16 }}>
            Done
          </Text>
        </Pressable>
        <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textTertiary, fontSize: 13 }}>
          {masteredCount} / {total} mastered
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 items-center justify-center px-6">
          {done ? (
            <>
              <Text
                style={{ fontFamily: Fonts.display, fontSize: 26, color: colors.textPrimary, textAlign: 'center' }}
              >
                You’ve gone through every unmastered word.
              </Text>
              <Pressable
                onPress={onExit}
                className="mt-6 rounded-full px-6 py-3 bg-brand-ui-light dark:bg-brand-ui-dark"
              >
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand, fontSize: 15 }}>
                  Back to vocabulary
                </Text>
              </Pressable>
            </>
          ) : !flipped ? (
            <Pressable
              onPress={() => setFlipped(true)}
              className="rounded-3xl px-8 py-16 items-center justify-center w-full border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text
                style={{ fontFamily: Fonts.display, fontSize: 36, color: colors.textPrimary, textAlign: 'center' }}
              >
                {card.word}
              </Text>
              <Text
                style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: 12 }}
              >
                Tap to flip
              </Text>
            </Pressable>
          ) : (
            <ScrollView
              style={{ flex: 1, width: '100%' }}
              contentContainerStyle={{ paddingVertical: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                onPress={() => setFlipped(false)}
                className="rounded-3xl px-6 py-6 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              >
                <Text style={{ fontFamily: Fonts.display, fontSize: 24, color: colors.textPrimary }}>
                  {card.word}
                </Text>
                <Text
                  style={{ fontFamily: Fonts.body, fontSize: 16, color: colors.textSecondary, marginTop: 12, lineHeight: 24 }}
                >
                  {card.definition || '(no definition saved)'}
                </Text>
                {(card.context_sentence || card.context) && (
                  <View className="mt-4 pt-4 border-t border-border-subtle-light dark:border-border-subtle-dark">
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textTertiary,
                        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
                      }}
                    >
                      Where you saw it
                    </Text>
                    <Text style={{ fontFamily: Fonts.bodyItalic, fontSize: 14, color: colors.textSecondary }}>
                      “{card.context_sentence || card.context}”
                    </Text>
                  </View>
                )}
              </Pressable>

              <View className="mt-4">
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textTertiary,
                    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
                  }}
                >
                  Try using it
                </Text>
                <TextInput
                  value={usage}
                  onChangeText={setUsage}
                  placeholder={`Use “${card.word}” in a sentence…`}
                  placeholderTextColor={colors.textTertiary}
                  className="rounded-xl px-4 py-3 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark text-text-primary-light dark:text-text-primary-dark"
                  style={{ fontFamily: Fonts.ui, fontSize: 14, minHeight: 64, textAlignVertical: 'top' }}
                  multiline
                />
                <Text
                  style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 6 }}
                >
                  Just for practice — nothing is graded or saved.
                </Text>
              </View>

              <View className="flex-row gap-3 mt-6">
                <Pressable
                  onPress={next}
                  className="flex-1 rounded-full py-3 items-center border border-border-interactive-light dark:border-border-interactive-dark"
                >
                  <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary }}>
                    Keep studying
                  </Text>
                </Pressable>
                <Pressable
                  onPress={markMastered}
                  className="flex-1 rounded-full py-3 items-center bg-brand-ui-light dark:bg-brand-ui-dark"
                >
                  <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                    Mastered ✓
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
