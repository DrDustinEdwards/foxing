import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import {
  Plus,
  Star,
  CaretDown,
  Funnel,
  Check,
  Trash,
  ArrowsLeftRight,
  PencilSimple,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  type CustomShelf,
  type UserBookStatus,
  createCustomShelf,
  deleteCustomShelf,
  listCustomShelves,
  renameCustomShelf,
  setRating,
  startReread,
} from '@/lib/library'
import { ShelfTabs } from '@/components/library/shelf-tabs'
import { LibraryEmptyState } from '@/components/library/library-empty-state'
import { sideloadEpub } from '@/lib/library-import'
import { AddBookSheet } from '@/components/library/add-book-sheet'
import { LibraryRow } from '@/components/library/library-row'
import { BulkActionButton, BulkRatePicker, BulkShelfPicker } from '@/components/library/bulk-actions'
import { CreateShelfModal, ReviewModal } from '@/components/library/library-modals'
import { type BookRow, SORT_OPTIONS, type ShelfKey, type SortKey } from '@/components/library/library-types'

export default function Library() {
  const colors = useColors()
  const router = useRouter()
  const [shelves, setShelves] = useState<CustomShelf[]>([])
  const [activeShelf, setActiveShelf] = useState<ShelfKey>({
    kind: 'status',
    status: 'reading',
    label: 'Reading',
  })
  const [books, setBooks] = useState<BookRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [createShelfOpen, setCreateShelfOpen] = useState(false)
  const [reviewSheet, setReviewSheet] = useState<BookRow | null>(null)
  const [sort, setSort] = useState<SortKey>('date_added')
  const [sortPickerOpen, setSortPickerOpen] = useState(false)
  const [minRating, setMinRating] = useState<number | null>(null) // filter
  const [fabOpen, setFabOpen] = useState(false)

  // Bulk edit mode. selectedBookIds holds user_books.id values (not book ids)
  // since all bulk actions write to user_books rows.
  const [editMode, setEditMode] = useState(false)
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set())
  const [bulkShelfPickerOpen, setBulkShelfPickerOpen] = useState(false)
  const [bulkRatePickerOpen, setBulkRatePickerOpen] = useState(false)

  const loadShelves = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)
    if (!user) {
      setShelves([])
      return
    }
    const list = await listCustomShelves(user.id)
    setShelves(list)
  }, [])

  const loadBooks = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setBooks([])
      setLoading(false)
      return
    }
    if (activeShelf.kind === 'status') {
      const { data } = await supabase
        .from('user_books')
        .select(
          'id, status, progress_percentage, created_at, finished_at, rating, rating_half, review, review_is_public, book:books(id, title, author, cover_url, word_count, series_name, epub_url)',
        )
        .eq('user_id', user.id)
        .eq('status', activeShelf.status)
      setBooks(((data ?? []) as unknown) as BookRow[])
    } else {
      // Custom shelf, pull book ids from custom_shelf_books, then hydrate
      // alongside any user_books row the user has for those books.
      const { data: shelfRows } = await supabase
        .from('custom_shelf_books')
        .select('book_id')
        .eq('shelf_id', activeShelf.shelfId)
      const ids = ((shelfRows ?? []) as Array<{ book_id: string }>).map((r) => r.book_id)
      if (ids.length === 0) {
        setBooks([])
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('user_books')
        .select(
          'id, status, progress_percentage, created_at, finished_at, rating, rating_half, review, review_is_public, book:books(id, title, author, cover_url, word_count, series_name, epub_url)',
        )
        .eq('user_id', user.id)
        .in('book_id', ids)
      setBooks(((data ?? []) as unknown) as BookRow[])
    }
    setLoading(false)
  }, [activeShelf])

  useEffect(() => {
    loadShelves()
  }, [loadShelves])
  useEffect(() => {
    loadBooks()
  }, [loadBooks])
  useFocusEffect(
    useCallback(() => {
      loadBooks()
    }, [loadBooks]),
  )

  // ── Sort + filter applied client-side over the fetched slice ──────────
  const visible = useMemo(() => {
    let list = [...books]
    if (minRating !== null) {
      list = list.filter((b) => (b.rating ?? 0) >= minRating)
    }
    list.sort((a, b) => {
      switch (sort) {
        case 'title':
          return (a.book?.title ?? '').localeCompare(b.book?.title ?? '')
        case 'author':
          return (a.book?.author ?? '').localeCompare(b.book?.author ?? '')
        case 'rating':
          return (b.rating ?? 0) - (a.rating ?? 0)
        case 'length':
          return (b.book?.word_count ?? 0) - (a.book?.word_count ?? 0)
        case 'date_finished':
          return (b.finished_at ?? '').localeCompare(a.finished_at ?? '')
        case 'date_added':
        default:
          return (b.created_at ?? '').localeCompare(a.created_at ?? '')
      }
    })
    return list
  }, [books, minRating, sort])

  const onCreateShelf = useCallback(
    async (name: string) => {
      if (!userId) return
      const shelf = await createCustomShelf(userId, name)
      if (shelf) {
        setShelves((prev) => [...prev, shelf])
        setActiveShelf({ kind: 'custom', shelfId: shelf.id, label: shelf.name })
      }
    },
    [userId],
  )

  // ── Bulk edit handlers ────────────────────────────────────────────────
  // All write to user_books rows by id. After each successful bulk action we
  // exit edit mode and reload the shelf so the UI reflects the new state.

  const exitBulkEdit = useCallback(() => {
    setEditMode(false)
    setSelectedBookIds(new Set())
  }, [])

  const toggleSelected = useCallback((userBookId: string) => {
    setSelectedBookIds((prev) => {
      const next = new Set(prev)
      if (next.has(userBookId)) next.delete(userBookId)
      else next.add(userBookId)
      return next
    })
  }, [])

  const onSelectAll = useCallback(() => {
    setSelectedBookIds((prev) => {
      if (prev.size === books.length && books.length > 0) {
        return new Set()
      }
      return new Set(books.map((b) => b.id))
    })
  }, [books])

  const bulkMoveToShelf = useCallback(
    async (status: UserBookStatus) => {
      const ids = [...selectedBookIds]
      if (ids.length === 0) return
      const update: Record<string, unknown> = { status }
      if (status === 'reading') update.started_at = new Date().toISOString()
      if (status === 'finished') update.finished_at = new Date().toISOString()
      await supabase.from('user_books').update(update).in('id', ids)
      setBulkShelfPickerOpen(false)
      exitBulkEdit()
      await loadBooks()
    },
    [exitBulkEdit, loadBooks, selectedBookIds],
  )

  const bulkSetRating = useCallback(
    async (rating: number) => {
      const ids = [...selectedBookIds]
      if (ids.length === 0) return
      await supabase.from('user_books').update({ rating }).in('id', ids)
      setBulkRatePickerOpen(false)
      exitBulkEdit()
      await loadBooks()
    },
    [exitBulkEdit, loadBooks, selectedBookIds],
  )

  const bulkDelete = useCallback(() => {
    const ids = [...selectedBookIds]
    if (ids.length === 0) return
    Alert.alert(
      `Remove ${ids.length} book${ids.length === 1 ? '' : 's'}?`,
      "They'll be removed from your library. You can re-add them anytime.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('user_books').delete().in('id', ids)
            exitBulkEdit()
            await loadBooks()
          },
        },
      ],
    )
  }, [exitBulkEdit, loadBooks, selectedBookIds])

  // Exit edit mode when the active shelf changes, feels intuitive and
  // avoids the user's selection silently spanning a different list.
  useEffect(() => {
    if (editMode) exitBulkEdit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShelf])

  const onLongPressShelf = useCallback(
    (shelf: CustomShelf) => {
      Alert.alert(shelf.name, undefined, [
        {
          text: 'Rename',
          onPress: () => {
            Alert.prompt?.('Rename shelf', undefined, async (name) => {
              if (!name || !name.trim()) return
              const ok = await renameCustomShelf(shelf.id, name.trim())
              if (ok) {
                setShelves((prev) =>
                  prev.map((s) => (s.id === shelf.id ? { ...s, name: name.trim() } : s)),
                )
                if (activeShelf.kind === 'custom' && activeShelf.shelfId === shelf.id) {
                  setActiveShelf({ kind: 'custom', shelfId: shelf.id, label: name.trim() })
                }
              }
            })
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteCustomShelf(shelf.id)
            if (ok) {
              setShelves((prev) => prev.filter((s) => s.id !== shelf.id))
              if (activeShelf.kind === 'custom' && activeShelf.shelfId === shelf.id) {
                setActiveShelf({ kind: 'status', status: 'reading', label: 'Reading' })
              }
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ])
    },
    [activeShelf],
  )

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
        <Text
          style={{ fontFamily: Fonts.displayBold, fontSize: 22, color: colors.textPrimary }}
        >
          {editMode
            ? selectedBookIds.size > 0
              ? `${selectedBookIds.size} selected`
              : 'Select books'
            : 'Library'}
        </Text>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          {editMode ? (
            <Pressable
              onPress={onSelectAll}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={
                selectedBookIds.size === books.length && books.length > 0
                  ? 'Deselect all books'
                  : 'Select all books'
              }
            >
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.brandText }}>
                {selectedBookIds.size === books.length && books.length > 0 ? 'None' : 'All'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => (editMode ? exitBulkEdit() : setEditMode(true))}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={editMode ? 'Exit bulk edit mode' : 'Edit library'}
            className="flex-row items-center"
            style={{ gap: 4 }}
          >
            {!editMode ? <PencilSimple color={colors.textPrimary} size={14} /> : null}
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
              {editMode ? 'Done' : 'Edit'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Shelf tabs, horizontal scroll across statuses + custom shelves + new */}
      <ShelfTabs
        activeShelf={activeShelf}
        shelves={shelves}
        onSelectShelf={setActiveShelf}
        onLongPressShelf={onLongPressShelf}
        onNewShelf={() => setCreateShelfOpen(true)}
      />

      {/* Sort + filter row */}
      <View className="flex-row items-center px-4 pt-2 pb-1 gap-2">
        <Pressable
          onPress={() => setSortPickerOpen((v) => !v)}
          className="flex-row items-center gap-1 px-3 py-1 rounded-full border"
          style={{ borderColor: colors.borderSubtle }}
        >
          <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textSecondary }}>
            Sort: {SORT_OPTIONS.find((o) => o.id === sort)?.label ?? 'Date added'}
          </Text>
          <CaretDown color={colors.textTertiary} size={10} />
        </Pressable>
        <Pressable
          onPress={() => setMinRating((r) => (r === null ? 4 : r === 4 ? 5 : null))}
          className="flex-row items-center gap-1 px-3 py-1 rounded-full border"
          style={{
            borderColor: minRating !== null ? colors.borderBrand : colors.borderSubtle,
            backgroundColor: minRating !== null ? colors.bgSelected : 'transparent',
          }}
        >
          <Funnel
            color={minRating !== null ? colors.brandText : colors.textSecondary}
            size={12}
          />
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 12,
              color: minRating !== null ? colors.brandText : colors.textSecondary,
            }}
          >
            {minRating === null ? 'All ratings' : `${minRating}+ ★`}
          </Text>
        </Pressable>
      </View>

      {sortPickerOpen ? (
        <View
          className="mx-4 mt-1 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          {SORT_OPTIONS.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => {
                setSort(o.id)
                setSortPickerOpen(false)
              }}
              className="px-3 py-2"
              style={{
                borderTopWidth: o.id === SORT_OPTIONS[0].id ? 0 : 1,
                borderTopColor: colors.borderSubtle,
              }}
            >
              <Text
                style={{
                  fontFamily: o.id === sort ? Fonts.uiMedium : Fonts.ui,
                  fontSize: 13,
                  color: o.id === sort ? colors.brandText : colors.textPrimary,
                }}
              >
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {loading ? (
          <ActivityIndicator color={colors.brandUi} />
        ) : visible.length === 0 ? (
          <LibraryEmptyState activeShelf={activeShelf} />
        ) : (
          visible.map((entry) => (
            <LibraryRow
              key={entry.id}
              row={entry}
              showRating={
                activeShelf.kind === 'status' && activeShelf.status === 'finished'
              }
              editMode={editMode}
              selected={selectedBookIds.has(entry.id)}
              onToggleSelect={() => toggleSelected(entry.id)}
              onOpen={() => entry.book && router.push(`/reader/${entry.book.id}`)}
              onLongPress={() => {
                if (!entry.book) return
                router.push({
                  pathname: '/quote-card',
                  params: {
                    type: 'reading',
                    bookId: entry.book.id,
                    bookTitle: entry.book.title,
                    author: entry.book.author,
                    coverUrl: entry.book.cover_url ?? '',
                    progress: String(entry.progress_percentage ?? 0),
                  },
                } as never)
              }}
              onRatingChange={async (value) => {
                await setRating(entry.id, value)
                setBooks((prev) =>
                  prev.map((b) =>
                    b.id === entry.id
                      ? { ...b, rating: Math.round(value), rating_half: value }
                      : b,
                  ),
                )
              }}
              onReview={() => setReviewSheet(entry)}
              onReread={async () => {
                if (!userId || !entry.book) return
                await startReread(userId, entry.book.id)
                loadBooks()
              }}
              onResume={async () => {
                await supabase
                  .from('user_books')
                  .update({ status: 'reading', paused_at: null, paused_note: null })
                  .eq('id', entry.id)
                loadBooks()
              }}
            />
          ))
        )}
      </ScrollView>

      {/* Create shelf modal */}
      <CreateShelfModal
        visible={createShelfOpen}
        onClose={() => setCreateShelfOpen(false)}
        onCreate={onCreateShelf}
      />

      {/* Review modal */}
      {reviewSheet ? (
        <ReviewModal
          row={reviewSheet}
          onClose={() => setReviewSheet(null)}
          onSaved={(review, isPublic) => {
            setBooks((prev) =>
              prev.map((b) =>
                b.id === reviewSheet.id
                  ? { ...b, review, review_is_public: isPublic }
                  : b,
              ),
            )
            setReviewSheet(null)
          }}
        />
      ) : null}

      {/* Add-a-book FAB, hidden in edit mode so it doesn't overlap with the
          bulk action bar (which lands in roughly the same screen position). */}
      {!editMode ? (
        <Pressable
          onPress={() => setFabOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Add a book"
          style={{
            position: 'absolute',
            right: 18,
            bottom: 24,
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.brandUi,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <Plus color={colors.textOnBrand} size={22} weight="bold" />
        </Pressable>
      ) : null}

      {/* Bulk action bar, anchored to the bottom in edit mode. Rate is only
          surfaced on the Finished shelf since rating a not-yet-finished book
          is the rare case. */}
      {editMode ? (
        <SafeAreaView
          edges={['bottom']}
          className="absolute bottom-0 left-0 right-0 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
        >
          <View className="flex-row items-center justify-around px-2 py-2">
            <BulkActionButton
              Icon={ArrowsLeftRight}
              label="Move"
              onPress={() => setBulkShelfPickerOpen(true)}
              disabled={selectedBookIds.size === 0}
            />
            {activeShelf.kind === 'status' && activeShelf.status === 'finished' ? (
              <BulkActionButton
                Icon={Star}
                label="Rate"
                onPress={() => setBulkRatePickerOpen(true)}
                disabled={selectedBookIds.size === 0}
              />
            ) : null}
            <BulkActionButton
              Icon={Trash}
              label="Delete"
              onPress={bulkDelete}
              disabled={selectedBookIds.size === 0}
              destructive
            />
            <BulkActionButton
              Icon={Check}
              label="Done"
              onPress={exitBulkEdit}
            />
          </View>
        </SafeAreaView>
      ) : null}

      <BulkShelfPicker
        visible={bulkShelfPickerOpen}
        onClose={() => setBulkShelfPickerOpen(false)}
        onPick={bulkMoveToShelf}
      />

      <BulkRatePicker
        visible={bulkRatePickerOpen}
        onClose={() => setBulkRatePickerOpen(false)}
        onPick={bulkSetRating}
      />

      <AddBookSheet
        visible={fabOpen}
        onClose={() => setFabOpen(false)}
        onBrowse={() => {
          setFabOpen(false)
          router.push('/(tabs)' as never)
        }}
        onImportEpub={async () => {
          setFabOpen(false)
          await sideloadEpub(router)
        }}
        onMatch={(bookId) => {
          setFabOpen(false)
          router.push(`/book/${bookId}` as never)
        }}
      />
    </SafeAreaView>
  )
}

// ── Add a book sheet, Browse catalog / Import EPUB ─────────────────────

// ── Row ──────────────────────────────────────────────────────────────────

// ── Bulk edit helpers ────────────────────────────────────────────────────

// ── Create shelf modal ──────────────────────────────────────────────────

// ── Review modal ────────────────────────────────────────────────────────

