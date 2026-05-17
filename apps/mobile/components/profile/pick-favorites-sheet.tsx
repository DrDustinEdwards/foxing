import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X as XIcon, BookOpen } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// Picker for the 5 Favorite Books grid on the profile tab. The caller passes
// the slot position (1..5) being filled and a callback for the chosen book.
// We only surface books the user has finished, favorites should mean
// something, not be a wishlist.

interface FinishedBook {
  id: string
  title: string
  author: string
  cover_url: string | null
}

interface PickFavoritesSheetProps {
  visible: boolean
  position: number | null
  onPick: (bookId: string) => Promise<void> | void
  onClose: () => void
}

export function PickFavoritesSheet({
  visible,
  position,
  onPick,
  onClose,
}: PickFavoritesSheetProps) {
  const colors = useColors()
  const [books, setBooks] = useState<FinishedBook[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setQuery('')
    setLoading(true)
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) {
          setBooks([])
          setLoading(false)
        }
        return
      }
      const { data } = await supabase
        .from('user_books')
        .select('book:books(id, title, author, cover_url)')
        .eq('user_id', user.id)
        .eq('status', 'finished')
        .order('finished_at', { ascending: false })
      type R = {
        book:
          | { id: string; title: string; author: string; cover_url: string | null }
          | Array<{ id: string; title: string; author: string; cover_url: string | null }>
          | null
      }
      const flat: FinishedBook[] = []
      const seen = new Set<string>()
      for (const r of ((data ?? []) as unknown) as R[]) {
        const b = Array.isArray(r.book) ? r.book[0] : r.book
        if (b && !seen.has(b.id)) {
          seen.add(b.id)
          flat.push(b)
        }
      }
      if (!cancelled) {
        setBooks(flat)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visible])

  // Local search filter, no Supabase round-trip per keystroke. Finished
  // libraries are small enough that client-side filtering is plenty fast.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return books
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q),
    )
  }, [books, query])

  const handlePick = useCallback(
    async (book: FinishedBook) => {
      if (position === null || saving) return
      setSaving(book.id)
      try {
        await onPick(book.id)
      } finally {
        setSaving(null)
      }
    },
    [onPick, position, saving],
  )

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark" edges={['top']}>
        <View className="flex-row items-center justify-between px-3 py-2">
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close favorites picker"
            className="p-2"
          >
            <XIcon color={colors.textPrimary} size={20} />
          </Pressable>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}>
            Pick favorite #{position ?? '?'}
          </Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your finished books"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search finished books"
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textPrimary,
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginVertical: 10,
            }}
          />
        </View>
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.brandUi} />
          </View>
        ) : filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <BookOpen color={colors.textTertiary} size={28} />
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textTertiary,
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              {books.length === 0
                ? 'Finish a book to add it as a favorite.'
                : 'No matches in your finished books.'}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            {filtered.map((b) => {
              const isSaving = saving === b.id
              return (
                <Pressable
                  key={b.id}
                  onPress={() => handlePick(b)}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${b.title}`}
                  accessibilityState={{ disabled: isSaving, busy: isSaving }}
                  className="flex-row items-center p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                  style={{ opacity: isSaving ? 0.7 : 1 }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 60,
                      borderRadius: 4,
                      overflow: 'hidden',
                      backgroundColor: colors.bgSunken,
                      marginRight: 10,
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
                      <BookOpen color={colors.textTertiary} size={16} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
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
                  {isSaving ? (
                    <ActivityIndicator color={colors.brandUi} size="small" />
                  ) : null}
                </Pressable>
              )
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  )
}
