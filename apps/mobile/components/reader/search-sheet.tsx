import { useState } from 'react'
import {
  View, Text, Pressable, ScrollView, TextInput, ActivityIndicator,
} from 'react-native'
import { X as XIcon } from 'phosphor-react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { friendlyAiError, semanticSearch, type SemanticSearchResult } from '@/lib/claude'

type SearchMode = 'exact' | 'ai'

interface SearchSheetProps {
  visible: boolean
  bookTitle: string
  bookId: string
  author: string
  chapterList: string[]
  onNavigateExact?: (cfi: string) => void
  onNavigateChapter?: (chapterName: string) => void
  onClose: () => void
}

export function SearchSheet({
  visible,
  bookTitle,
  bookId: _bookId,
  author,
  chapterList,
  onNavigateExact: _onNavigateExact,
  onNavigateChapter,
  onClose,
}: SearchSheetProps) {
  const colors = useColors()
  const [mode, setMode] = useState<SearchMode>('exact')
  const [query, setQuery] = useState('')
  const [aiResults, setAiResults] = useState<SemanticSearchResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runSearch() {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setAiResults(null)
    try {
      if (mode === 'ai') {
        // The AI ranks the chapter list rather than searching raw text, full
        // book context would blow the token budget. The host then routes a
        // tap to the start of the chosen chapter.
        const results = await semanticSearch(query.trim(), bookTitle, author, chapterList)
        setAiResults(results)
      } else {
        // Exact search would route through the WebView's foliate search API.
        // That's a separate bridge call to add, for now, surface a friendly
        // "not yet wired" rather than silent failure.
        setError('Exact search inside the book is coming soon. Try AI Search for now.')
      }
    } catch (e) {
      setError(friendlyAiError(e))
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setQuery('')
    setAiResults(null)
    setError(null)
    onClose()
  }

  return (
    <SheetScaffold
      visible={visible}
      onClose={handleClose}
      variant="bottom"
      scroll={false}
      maxHeight="88%"
      contentContainerStyle={{ flex: 1, paddingHorizontal: 20 }}
    >
            <View className="flex-row items-center justify-between mb-3">
              <Text style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary }}>
                Search
              </Text>
              <Pressable onPress={handleClose}>
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>Close</Text>
              </Pressable>
            </View>

            <View
              className="flex-row rounded-xl p-1 mb-3 bg-bg-sunken-light dark:bg-bg-sunken-dark"
            >
              {(['exact', 'ai'] as SearchMode[]).map((m) => {
                const active = m === mode
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMode(m)}
                    className="flex-1 items-center py-2 rounded-lg"
                    style={{ backgroundColor: active ? colors.bgSurface : 'transparent' }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium, fontSize: 12,
                        color: active ? colors.textPrimary : colors.textTertiary,
                      }}
                    >
                      {m === 'exact' ? 'Exact' : 'AI Search'}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={
                mode === 'ai'
                  ? 'Find where the monster speaks for the first time…'
                  : 'Search for a word or phrase…'
              }
              placeholderTextColor={colors.textTertiary}
              className="rounded-xl px-4 py-3 mb-3 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark text-text-primary-light dark:text-text-primary-dark"
              style={{ fontFamily: Fonts.ui, fontSize: 14 }}
              onSubmitEditing={runSearch}
              returnKeyType="search"
            />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
              {loading ? (
                <View className="py-12 items-center">
                  <ActivityIndicator color={colors.brandUi} />
                  <Text
                    style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary, marginTop: 12 }}
                  >
                    {mode === 'ai' ? 'Asking the companion…' : 'Searching…'}
                  </Text>
                </View>
              ) : error ? (
                <View className="rounded-xl p-3 flex-row gap-2 items-start bg-error-bg-light dark:bg-error-bg-dark">
                  <XIcon color={colors.error} size={16} />
                  <Text style={{ fontFamily: Fonts.ui, color: colors.error, flex: 1 }}>{error}</Text>
                </View>
              ) : aiResults ? (
                aiResults.length === 0 ? (
                  <Text
                    style={{ fontFamily: Fonts.ui, color: colors.textTertiary, textAlign: 'center', marginTop: 16 }}
                  >
                    No likely chapters identified, try rephrasing.
                  </Text>
                ) : (
                  aiResults.map((r, i) => (
                    <Pressable
                      key={`${r.chapterName}-${i}`}
                      onPress={() => {
                        onNavigateChapter?.(r.chapterName)
                        handleClose()
                      }}
                      className="mb-3 rounded-2xl p-4 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                    >
                      <View className="flex-row items-center justify-between">
                        <Text
                          style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary, flex: 1 }}
                          numberOfLines={1}
                        >
                          {r.chapterName}
                        </Text>
                        <View
                          className="rounded-full px-2 py-0.5"
                          style={{ backgroundColor: colors.brandSubtle }}
                        >
                          <Text
                            style={{
                              fontFamily: Fonts.uiMedium, fontSize: 10,
                              color: colors.brandSubtleText,
                              textTransform: 'uppercase', letterSpacing: 0.5,
                            }}
                          >
                            {r.confidence}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 6 }}
                      >
                        {r.explanation}
                      </Text>
                    </Pressable>
                  ))
                )
              ) : (
                <Text
                  style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary, textAlign: 'center', marginTop: 16 }}
                >
                  {mode === 'ai'
                    ? 'Ask in plain English, the companion will tell you which chapters likely match.'
                    : 'Type a word or phrase, then tap search.'}
                </Text>
              )}
            </ScrollView>
    </SheetScaffold>
  )
}
