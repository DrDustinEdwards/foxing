import { useEffect, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { X as XIcon } from 'phosphor-react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { friendlyAiError, getBilingualParagraphs } from '@/lib/claude'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// Side-by-side translation of the current selection. Source paragraphs (a
// single word is one "paragraph") render in the left column, the model's
// translation in the right. Plus-gated server-side via the ai-companion
// bilingual_paragraph action, same as the other on-demand AI actions; a free
// user gets the upgrade copy through friendlyAiError.
interface TranslateSheetProps {
  visible: boolean
  paragraphs: string[]
  targetLanguage: string
  bookTitle: string
  author: string
  bookId: string
  currentChapter?: string
  onClose: () => void
}

export function TranslateSheet({
  visible,
  paragraphs,
  targetLanguage,
  bookTitle,
  author,
  bookId,
  currentChapter,
  onClose,
}: TranslateSheetProps) {
  const colors = useColors()
  const [translations, setTranslations] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stable dependency for the fetch effect (the array identity changes each
  // render otherwise).
  const sourceKey = paragraphs.join('')
  useEffect(() => {
    if (!visible || paragraphs.length === 0) return
    setTranslations(null)
    setError(null)
    setLoading(true)
    ;(async () => {
      try {
        const result = await getBilingualParagraphs({
          paragraphs,
          targetLanguage,
          bookTitle,
          author,
          bookId,
          currentChapter,
        })
        setTranslations(result)
      } catch (e) {
        setError(friendlyAiError(e))
      } finally {
        setLoading(false)
      }
    })()
    // paragraphs is captured via sourceKey; bookId/title are stable per book.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sourceKey, targetLanguage])

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 8 }}
    >
      <View
        className="flex-row justify-between items-center"
        style={{ marginBottom: 16 }}
      >
        <View>
          <Text style={{ fontFamily: Fonts.display, fontSize: 20, color: colors.brandText }}>
            Translate
          </Text>
          <Text
            style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}
          >
            {targetLanguage}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close translation"
        >
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.brandText }}>
            Close
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator
          color={colors.brandUi}
          accessibilityLiveRegion="polite"
          accessibilityLabel="Loading translation"
        />
      ) : error ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: colors.errorBg,
          }}
        >
          <XIcon color={colors.error} size={16} />
          <Text style={{ flex: 1, fontFamily: Fonts.ui, fontSize: 14, color: colors.error }}>
            {error}
          </Text>
        </View>
      ) : translations && translations.length > 0 ? (
        <View>
          {paragraphs.map((src, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', gap: 14, marginBottom: 18 }}
            >
              <Text
                style={{
                  flex: 1,
                  fontFamily: Fonts.body,
                  fontSize: 16,
                  lineHeight: 26,
                  color: colors.textPrimary,
                }}
              >
                {src}
              </Text>
              <View style={{ width: 1, backgroundColor: colors.borderSubtle }} />
              <Text
                style={{
                  flex: 1,
                  fontFamily: Fonts.body,
                  fontSize: 16,
                  lineHeight: 26,
                  color: colors.textSecondary,
                }}
              >
                {translations[i] ?? ''}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textTertiary }}>
          No translation came back. Try again.
        </Text>
      )}
    </SheetScaffold>
  )
}
