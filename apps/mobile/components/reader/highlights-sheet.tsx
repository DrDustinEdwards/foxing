import { errorMessage, useBookAnnotations } from '@foxing/client'
import { useState, useCallback } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Share } from 'react-native'
import { X as XIcon, Export } from 'phosphor-react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { encodeLocator } from '@/components/reader/readium-helpers'
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/components/reader/floating-pill'
import {
  exportAsCsv,
  exportAsMarkdown,
  exportAsText,
  type ExportableHighlight,
} from '@/lib/export-annotations'

interface HighlightRow {
  id: string
  cfi: string
  text: string
  color: HighlightColor | string
  note: string | null
  chapter: string | null
}

interface HighlightsSheetProps {
  visible: boolean
  bookTitle: string
  bookAuthor?: string
  bookId: string
  // Excerpt + chapter give the Readium renderer a fallback path for
  // legacy foliate epubcfi values that can't be decoded as Locator JSON.
  onNavigate: (cfi: string, text: string, chapter: string | null) => void
  onClose: () => void
}

type ExportFormat = 'text' | 'csv' | 'markdown'

export function HighlightsSheet({
  visible,
  bookTitle,
  bookAuthor = '',
  bookId,
  onNavigate,
  onClose,
}: HighlightsSheetProps) {
  const colors = useColors()
  const layers = useBookAnnotations(bookId)
  const loading = layers.isPending
  const error = errorMessage(layers.error)
  const rows: HighlightRow[] = (layers.data?.mine ?? [])
    .filter((m) => (m.type === 'highlight' || m.type === 'note') && m.locator)
    .map((m) => ({
      id: m.id,
      cfi: encodeLocator(m.locator!),
      text: m.selectedText ?? '',
      color: m.color ?? '',
      note: m.body,
      chapter: m.chapter,
    }))
    .reverse()
  const [filterColor, setFilterColor] = useState<HighlightColor | null>(null)
  const [formatPickerOpen, setFormatPickerOpen] = useState(false)

  const swatchBg = useCallback((c: string) => {
    switch (c) {
      case 'amber': return colors.hlAmberT
      case 'auburn': return colors.hlAuburnT
      case 'yellow': return colors.hlYellowT
      case 'sage': return colors.hlSageT
      case 'cobalt': return colors.hlCobaltT
      case 'crimson': return colors.hlCrimsonT
      case 'purple': return colors.hlPurpleT
      default: return colors.borderDefault
    }
  }, [colors])

  const filtered = filterColor ? rows.filter((r) => r.color === filterColor) : rows

  // Export uses the visible-filtered set so users can pull a single color's
  // highlights when they want a focused list.
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setFormatPickerOpen(false)
      const payload: ExportableHighlight[] = filtered.map((h) => ({
        text: h.text,
        note: h.note,
        color: h.color ?? null,
        chapter: h.chapter,
      }))
      let body: string
      if (format === 'csv') body = exportAsCsv(payload, bookTitle, bookAuthor)
      else if (format === 'markdown') body = exportAsMarkdown(payload, bookTitle, bookAuthor)
      else body = exportAsText(payload, bookTitle, bookAuthor)
      try {
        await Share.share({ message: body })
      } catch {
        /* user cancelled */
      }
    },
    [bookAuthor, bookTitle, filtered],
  )

  return (
    <>
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      scroll={false}
      maxHeight="88%"
      contentContainerStyle={{ flex: 1, paddingHorizontal: 20 }}
    >
          <View className="flex-row items-center justify-between mb-3">
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary }}>
                My Highlights
              </Text>
              <Text
                style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}
                numberOfLines={1}
              >
                {bookTitle}
              </Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 14 }}>
              <Pressable
                onPress={() => setFormatPickerOpen(true)}
                disabled={filtered.length === 0}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Export highlights"
                style={{ opacity: filtered.length === 0 ? 0.4 : 1, padding: 2 }}
              >
                <Export color={colors.textPrimary} size={20} weight="regular" />
              </Pressable>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close highlights">
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>Close</Text>
              </Pressable>
            </View>
          </View>

          {/* Color filter strip */}
          <View className="flex-row items-center mb-4 gap-2">
            <Pressable
              onPress={() => setFilterColor(null)}
              className="rounded-full px-3 py-1 border"
              style={{
                backgroundColor: filterColor === null ? colors.brandUi : 'transparent',
                borderColor: filterColor === null ? colors.brandUi : colors.borderSubtle,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium, fontSize: 12,
                  color: filterColor === null ? colors.textOnBrand : colors.textSecondary,
                }}
              >
                All
              </Text>
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {HIGHLIGHT_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setFilterColor(filterColor === c ? null : c)}
                    style={{
                      width: 24, height: 24, borderRadius: 12,
                      backgroundColor: swatchBg(c),
                      borderWidth: 2,
                      borderColor: filterColor === c ? colors.brandUi : colors.borderSubtle,
                    }}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
            {loading ? (
              <View className="py-12 items-center">
                <ActivityIndicator color={colors.brandUi} />
              </View>
            ) : error ? (
              <View className="rounded-xl p-4 flex-row gap-2 items-start bg-error-bg-light dark:bg-error-bg-dark">
                <XIcon color={colors.error} size={16} />
                <Text style={{ fontFamily: Fonts.ui, color: colors.error, flex: 1 }}>{error}</Text>
              </View>
            ) : filtered.length === 0 ? (
              <Text
                style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textTertiary, textAlign: 'center', marginTop: 32 }}
              >
                You haven’t highlighted anything yet. Long press any word to start.
              </Text>
            ) : (
              filtered.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => {
                    onNavigate(h.cfi, h.text, h.chapter)
                    onClose()
                  }}
                  className="mb-3 rounded-2xl flex-row overflow-hidden border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <View style={{ width: 4, backgroundColor: swatchBg(h.color) }} />
                  <View style={{ flex: 1, padding: 12 }}>
                    <Text
                      style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textPrimary, lineHeight: 21 }}
                      numberOfLines={3}
                    >
                      {h.text}
                    </Text>
                    {h.chapter ? (
                      <Text
                        style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 6 }}
                        numberOfLines={1}
                      >
                        {h.chapter}
                      </Text>
                    ) : null}
                    {h.note ? (
                      <Text
                        style={{
                          fontFamily: Fonts.bodyItalic, fontSize: 13,
                          color: colors.textSecondary, marginTop: 6,
                        }}
                      >
                        “{h.note}”
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
    </SheetScaffold>

    <SheetScaffold
      visible={formatPickerOpen}
      onClose={() => setFormatPickerOpen(false)}
      variant="bottom"
      scroll={false}
      header={
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 8,
              }}
            >
              Export {filtered.length} highlight{filtered.length === 1 ? '' : 's'} as
            </Text>
      }
    >
            {([
              { id: 'text', label: 'Plain Text' },
              { id: 'csv', label: 'CSV' },
              { id: 'markdown', label: 'Markdown' },
            ] as Array<{ id: ExportFormat; label: string }>).map((opt, i) => (
              <Pressable
                key={opt.id}
                onPress={() => handleExport(opt.id)}
                accessibilityRole="button"
                accessibilityLabel={`Export as ${opt.label}`}
                className="px-5 py-3"
                style={{
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.borderSubtle,
                }}
              >
                <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
    </SheetScaffold>
    </>
  )
}
