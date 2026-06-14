import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { X as XIcon, Dot } from 'phosphor-react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { friendlyAiError, getCharacterMap, type CharacterEntry } from '@/lib/claude'

interface CharacterMapSheetProps {
  visible: boolean
  bookTitle: string
  bookId: string
  author: string
  currentChapter: string
  progress: number
  onClose: () => void
}

const ROLE_ORDER: Record<string, number> = {
  protagonist: 0,
  antagonist: 1,
  supporting: 2,
  minor: 3,
}

export function CharacterMapSheet({
  visible,
  bookTitle,
  bookId,
  author,
  currentChapter,
  progress,
  onClose,
}: CharacterMapSheetProps) {
  const colors = useColors()
  const [chars, setChars] = useState<CharacterEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedName, setExpandedName] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    if (chars) return // session-cache: only fetch once per open lifecycle
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const result = await getCharacterMap(bookTitle, author, currentChapter, {
          bookId,
          progress,
        })
        // Sort by role, then alphabetically.
        const sorted = [...result].sort((a, b) => {
          const ra = ROLE_ORDER[a.role] ?? 9
          const rb = ROLE_ORDER[b.role] ?? 9
          if (ra !== rb) return ra - rb
          return a.name.localeCompare(b.name)
        })
        setChars(sorted)
      } catch (e) {
        setError(friendlyAiError(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [visible, bookTitle, author, currentChapter, bookId, progress, chars])

  function handleClose() {
    setExpandedName(null)
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
          <View className="flex-row items-center justify-between mb-2">
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary }} numberOfLines={1}>
                Characters in {bookTitle}
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandText,
                  marginTop: 2,
                }}
              >
                Spoiler-free · So far
              </Text>
            </View>
            <Pressable onPress={handleClose}>
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}>
            {loading ? (
              <View className="py-12 items-center">
                <ActivityIndicator color={colors.brandUi} />
                <Text
                  style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary, marginTop: 12 }}
                >
                  Reading the cast list…
                </Text>
              </View>
            ) : error ? (
              <View className="rounded-xl p-4 flex-row gap-2 items-start bg-error-bg-light dark:bg-error-bg-dark">
                <XIcon color={colors.error} size={16} />
                <Text style={{ fontFamily: Fonts.ui, color: colors.error, flex: 1 }}>{error}</Text>
              </View>
            ) : !chars || chars.length === 0 ? (
              <Text style={{ fontFamily: Fonts.ui, color: colors.textTertiary }}>
                No characters yet, keep reading and check back.
              </Text>
            ) : (
              chars.map((c) => {
                const expanded = expandedName === c.name
                return (
                  <Pressable
                    key={c.name}
                    onPress={() => setExpandedName(expanded ? null : c.name)}
                    className="mb-3 rounded-2xl p-4 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text
                        style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary, flex: 1 }}
                        numberOfLines={1}
                      >
                        {c.name}
                      </Text>
                      <View
                        className="rounded-full px-2 py-0.5"
                        style={{ backgroundColor: colors.brandSubtle }}
                      >
                        <Text
                          style={{
                            fontFamily: Fonts.uiMedium, fontSize: 10, color: colors.brandSubtleText,
                            textTransform: 'uppercase', letterSpacing: 0.5,
                          }}
                        >
                          {c.role}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 6 }}
                      numberOfLines={expanded ? undefined : 2}
                    >
                      {c.description}
                    </Text>
                    {expanded && c.relationships?.length > 0 && (
                      <View className="mt-3 pt-3 border-t border-border-subtle-light dark:border-border-subtle-dark">
                        <Text
                          style={{
                            fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textTertiary,
                            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
                          }}
                        >
                          Relationships
                        </Text>
                        {c.relationships.map((r, i) => (
                          <View key={i} className="flex-row items-start mb-1">
                            <Dot color={colors.textTertiary} size={16} />
                            <Text
                              style={{
                                fontFamily: Fonts.ui, fontSize: 13,
                                color: colors.textSecondary, flex: 1, marginLeft: 2,
                              }}
                            >
                              {r}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </Pressable>
                )
              })
            )}
          </ScrollView>
    </SheetScaffold>
  )
}
