import { useCallback, useState } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { X as XIcon, BookmarkSimple } from 'phosphor-react-native'
import { analyzePassage, friendlyAiError, type PassageAnalysisType } from '@/lib/claude'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

const MODES: Array<{ key: PassageAnalysisType; label: string }> = [
  { key: 'rewrite', label: 'Plain English' },
  { key: 'historical', label: 'Historical Context' },
  { key: 'literary', label: 'Literary Devices' },
  { key: 'thematic', label: 'Themes' },
  { key: 'motivation', label: 'Character Motivation' },
  { key: 'passage_comparison', label: 'Compare to Another' },
  { key: 'perspective', label: 'Narrative Perspective' },
  { key: 'readability', label: 'Readability Score' },
]

interface PassageAnalysisSheetProps {
  visible: boolean
  passage: string
  bookTitle: string
  author: string
  era: string
  bookId?: string
  currentChapter?: string
  progress?: number
  // CFI of the selected passage, required to save to commonplace_entries.
  cfi?: string | null
  onClose: () => void
}

export function PassageAnalysisSheet({
  visible,
  passage,
  bookTitle,
  author,
  era,
  bookId,
  currentChapter,
  progress,
  cfi,
  onClose,
}: PassageAnalysisSheetProps) {
  const colors = useColors()
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<PassageAnalysisType | null>(null)
  const [commonplaceState, setCommonplaceState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  )

  async function run(mode: PassageAnalysisType) {
    console.log('[passage-analysis] run', { mode, passageChars: passage.length })
    setActiveMode(mode)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const text = await analyzePassage(passage, mode, bookTitle, author, era, {
        bookId,
        currentChapter,
        progress,
      })
      console.log('[passage-analysis] result', { mode, chars: text.length })
      setResult(text)
    } catch (e) {
      const message = friendlyAiError(e)
      console.warn('[passage-analysis] error', message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  // Save to commonplace_entries, book_id may be null if we couldn't resolve
  // (legacy reader paths) but we always have the passage text.
  const addToCommonplace = useCallback(async () => {
    if (commonplaceState === 'saving' || commonplaceState === 'saved') return
    setCommonplaceState('saving')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setCommonplaceState('error')
      return
    }
    const { error: insertError } = await supabase.from('commonplace_entries').insert({
      user_id: user.id,
      book_id: bookId ?? null,
      passage_text: passage.slice(0, 4000),
      cfi: cfi ?? null,
    })
    if (insertError) {
      console.warn('[passage-analysis] commonplace insert failed:', insertError.message)
      setCommonplaceState('error')
    } else {
      setCommonplaceState('saved')
    }
  }, [bookId, cfi, commonplaceState, passage])

  function handleClose() {
    setActiveMode(null)
    setResult(null)
    setError(null)
    setCommonplaceState('idle')
    onClose()
  }

  const commonplaceLabel =
    commonplaceState === 'saved'
      ? 'Saved'
      : commonplaceState === 'saving'
        ? 'Saving…'
        : commonplaceState === 'error'
          ? "Couldn't save, tap to retry"
          : 'Save Passage'

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable className="flex-1 justify-end" onPress={handleClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl px-6 pt-6 pb-10 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
          style={{ maxHeight: '90%' }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="font-display text-lg text-text-primary-light dark:text-text-primary-dark">
              Passage analysis
            </Text>
            <Pressable onPress={handleClose}>
              <Text className="font-ui text-brand-text-light dark:text-brand-text-dark">Close</Text>
            </Pressable>
          </View>

          <View
            className="rounded-lg p-3 mb-3 bg-bg-sunken-light dark:bg-bg-sunken-dark border-l-4 border-border-brand-light dark:border-border-brand-dark"
            style={{ maxHeight: 100 }}
          >
            <Text
              className="font-body italic text-sm text-text-secondary-light dark:text-text-secondary-dark"
              numberOfLines={4}
            >
              "{passage}"
            </Text>
          </View>

          {/* Commonplace button, always available, independent of analysis */}
          <Pressable
            onPress={addToCommonplace}
            disabled={commonplaceState === 'saving' || commonplaceState === 'saved'}
            className="flex-row items-center justify-center gap-2 py-2 mb-3 rounded-full border"
            style={{
              borderColor:
                commonplaceState === 'saved' ? colors.successBorder : colors.borderInteractive,
              backgroundColor:
                commonplaceState === 'saved' ? colors.successBg : 'transparent',
              opacity: commonplaceState === 'saving' ? 0.7 : 1,
            }}
          >
            <BookmarkSimple
              color={commonplaceState === 'saved' ? colors.success : colors.textPrimary}
              size={14}
              weight={commonplaceState === 'saved' ? 'fill' : 'regular'}
            />
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: commonplaceState === 'saved' ? colors.success : colors.textPrimary,
              }}
            >
              {commonplaceLabel}
            </Text>
          </Pressable>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {MODES.map((m) => {
                const active = activeMode === m.key
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => run(m.key)}
                    className={
                      active
                        ? 'rounded-full px-3 py-2 border bg-brand-ui-light dark:bg-brand-ui-dark border-border-interactive-light dark:border-border-interactive-dark'
                        : 'rounded-full px-3 py-2 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark'
                    }
                  >
                    <Text
                      className={
                        active
                          ? 'font-ui text-xs text-text-on-brand'
                          : 'font-ui text-xs text-text-primary-light dark:text-text-primary-dark'
                      }
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </ScrollView>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {loading ? (
              <ActivityIndicator color={colors.brandUi} />
            ) : error ? (
              <View className="flex-row items-start gap-2 rounded-lg px-3 py-2 bg-error-bg-light dark:bg-error-bg-dark">
                <XIcon color={colors.error} size={16} />
                <Text className="font-ui flex-1 text-error-light dark:text-error-dark">
                  {error}
                </Text>
              </View>
            ) : result ? (
              <Text className="font-body text-base leading-7 text-text-primary-light dark:text-text-primary-dark">
                {result}
              </Text>
            ) : (
              <Text className="font-ui text-sm text-text-tertiary-light dark:text-text-tertiary-dark">
                Pick an analysis above to begin.
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
