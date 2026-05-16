import { useEffect, useState, useCallback } from 'react'
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { supabase } from '@/lib/supabase'
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/components/reader/floating-pill'

interface HighlightRow {
  id: string
  cfi: string
  text: string
  color: HighlightColor | string
  note: string | null
  chapter: string | null
  created_at: string
}

interface HighlightsSheetProps {
  visible: boolean
  bookTitle: string
  bookId: string
  onNavigate: (cfi: string) => void
  onClose: () => void
}

export function HighlightsSheet({
  visible,
  bookTitle,
  bookId,
  onNavigate,
  onClose,
}: HighlightsSheetProps) {
  const colors = useColors()
  const [rows, setRows] = useState<HighlightRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterColor, setFilterColor] = useState<HighlightColor | null>(null)

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

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      const { data, error: err } = await supabase
        .from('highlights')
        .select('id, cfi, text, color, note, chapter, created_at')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (err) {
        setError(err.message)
      } else {
        setRows((data ?? []) as HighlightRow[])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [visible, bookId])

  const filtered = filterColor ? rows.filter((r) => r.color === filterColor) : rows

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl pt-4 pb-8 px-5 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
          style={{ maxHeight: '88%' }}
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
            <Pressable onPress={onClose}>
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>Close</Text>
            </Pressable>
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
                <Text style={{ color: colors.error }}>✕</Text>
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
                    onNavigate(h.cfi)
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
        </Pressable>
      </Pressable>
    </Modal>
  )
}
