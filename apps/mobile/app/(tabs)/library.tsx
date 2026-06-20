import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput,
  Alert,
  Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { useFocusEffect, useRouter } from 'expo-router'
import {
  Plus,
  Star,
  StarHalf,
  ArrowClockwise,
  Pause,
  Play,
  X as XIcon,
  DotsThreeVertical,
  CaretDown,
  Funnel,
  Compass,
  UploadSimple,
  LinkSimple,
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
  saveReview,
  setRating,
  startReread,
} from '@/lib/library'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { ShelfTabs } from '@/components/library/shelf-tabs'
import { LibraryEmptyState } from '@/components/library/library-empty-state'

export type ShelfKey =
  | { kind: 'status'; status: UserBookStatus; label: string }
  | { kind: 'custom'; shelfId: string; label: string }

export const STATUS_SHELVES: Array<{ status: UserBookStatus; label: string }> = [
  { status: 'reading', label: 'Reading' },
  { status: 'paused', label: 'Paused' },
  { status: 'want_to_read', label: 'Want to Read' },
  { status: 'finished', label: 'Finished' },
  { status: 'abandoned', label: 'Abandoned' },
]

type SortKey =
  | 'date_added'
  | 'date_finished'
  | 'title'
  | 'author'
  | 'rating'
  | 'length'

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: 'date_added', label: 'Date added' },
  { id: 'date_finished', label: 'Date finished' },
  { id: 'title', label: 'Title' },
  { id: 'author', label: 'Author' },
  { id: 'rating', label: 'Rating' },
  { id: 'length', label: 'Length' },
]

interface BookRow {
  id: string
  status: UserBookStatus
  progress_percentage: number
  created_at: string
  finished_at: string | null
  rating: number | null
  rating_half: number | null
  review: string | null
  review_is_public: boolean | null
  book: {
    id: string
    title: string
    author: string
    cover_url: string | null
    word_count: number | null
    series_name: string | null
    epub_url: string | null
  } | null
}

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

// ── EPUB sideloading ────────────────────────────────────────────────────
//
// Pick a file, upload to Supabase Storage under the user's personal
// folder, create books + user_books rows, navigate to reader.
//
// Storage bucket assumed: `epubs` (public read). Path:
//   personal/{userId}/{timestamp-filename}.epub
async function sideloadEpub(router: ReturnType<typeof useRouter>): Promise<void> {
  let pick: DocumentPicker.DocumentPickerResult
  try {
    pick = await DocumentPicker.getDocumentAsync({
      type: ['application/epub+zip', '*/*'],
      copyToCacheDirectory: true,
    })
  } catch (e) {
    console.warn('[library] doc pick failed:', e instanceof Error ? e.message : e)
    return
  }
  if (pick.canceled) return
  const asset = pick.assets?.[0]
  if (!asset?.uri) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const safeName = (asset.name ?? 'book.epub').replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `personal/${user.id}/${Date.now()}-${safeName}`

  try {
    // RN's fetch handles file:// URIs and gives us an ArrayBuffer that
    // Supabase Storage can upload directly. expo-file-system would also
    // work via readAsStringAsync({encoding:'base64'}) → decode, but the
    // fetch path skips the base64 round-trip.
    const arrayBuffer = await fetch(asset.uri).then((r) => r.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from('epubs')
      .upload(storagePath, arrayBuffer, {
        contentType: 'application/epub+zip',
        upsert: false,
      })
    if (uploadError) {
      console.warn('[library] upload failed:', uploadError.message)
      return
    }
    const { data: pub } = supabase.storage.from('epubs').getPublicUrl(storagePath)
    const publicUrl = pub.publicUrl

    // Strip the .epub for a humane default title, user can rename in
    // the library row later (not yet wired but planned).
    const inferredTitle = safeName.replace(/\.epub$/i, '').replace(/[_-]+/g, ' ').trim()
    const { data: bookRow, error: insertError } = await supabase
      .from('books')
      .insert({
        title: inferredTitle || 'Imported book',
        author: 'Unknown',
        source: 'personal',
        epub_url: publicUrl,
        language: 'en',
      })
      .select('id')
      .single()
    if (insertError || !bookRow) {
      console.warn('[library] book insert failed:', insertError?.message)
      return
    }
    await supabase.from('user_books').upsert(
      {
        user_id: user.id,
        book_id: (bookRow as { id: string }).id,
        status: 'reading',
        started_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,book_id' },
    )
    router.push(`/reader/${(bookRow as { id: string }).id}` as never)
  } catch (e) {
    console.warn('[library] sideload failed:', e instanceof Error ? e.message : e)
  } finally {
    // Cache cleanup, DocumentPicker copies to cache by default.
    try {
      await FileSystem.deleteAsync(asset.uri, { idempotent: true })
    } catch {}
  }
}

// ── Add a book sheet, Browse catalog / Import EPUB ─────────────────────

function AddBookSheet({
  visible,
  onClose,
  onBrowse,
  onImportEpub,
  onMatch,
}: {
  visible: boolean
  onClose: () => void
  onBrowse: () => void
  onImportEpub: () => void
  onMatch: (bookId: string) => void
}) {
  const colors = useColors()
  // Two-step sheet: 'choose' shows the three actions; 'url' swaps in a text
  // input + lookup result. Keeping it inside the same modal avoids modal
  // stacking jank on Android.
  const [mode, setMode] = useState<'choose' | 'url'>('choose')
  const [url, setUrl] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) {
      // Reset to the chooser whenever the sheet closes so the next open
      // starts fresh instead of remembering the previous URL search state.
      setMode('choose')
      setUrl('')
      setLookupBusy(false)
      setLookupError(null)
    }
  }, [visible])

  const submitUrl = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed || lookupBusy) return
    setLookupBusy(true)
    setLookupError(null)
    try {
      const match = await findBookFromUrl(trimmed)
      if (!match) {
        setLookupError("This book isn't in the Foxing catalog yet.")
        return
      }
      // Add to Want to Read for the signed-in user, then hand off to the
      // book detail page so the user can decide to start reading.
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('user_books').upsert(
          { user_id: user.id, book_id: match.id, status: 'want_to_read' },
          { onConflict: 'user_id,book_id' },
        )
      }
      onMatch(match.id)
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : 'Lookup failed.')
    } finally {
      setLookupBusy(false)
    }
  }, [lookupBusy, onMatch, url])

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      header={
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            paddingHorizontal: 20,
            marginBottom: 8,
          }}
        >
          {mode === 'url' ? 'Add from URL' : 'Add a book'}
        </Text>
      }
    >
          {mode === 'choose' ? (
            <>
              <AddOption
                Icon={Compass}
                label="Browse catalog"
                subtitle="Public-domain classics from Gutenberg + Standard Ebooks"
                onPress={onBrowse}
              />
              <AddOption
                Icon={UploadSimple}
                label="Import a book"
                subtitle="Sideload an EPUB file from your device"
                onPress={onImportEpub}
                topBorder
              />
              <AddOption
                Icon={LinkSimple}
                label="Add from URL"
                subtitle="Paste a Gutenberg, Standard Ebooks, Goodreads, or Open Library link"
                onPress={() => setMode('url')}
                topBorder
              />
            </>
          ) : (
            <View style={{ paddingHorizontal: 20 }}>
              <TextInput
                value={url}
                onChangeText={setUrl}
                placeholder="Paste a link to a book"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="search"
                onSubmitEditing={submitUrl}
                editable={!lookupBusy}
                style={{
                  fontFamily: Fonts.body,
                  fontSize: 14,
                  color: colors.textPrimary,
                  backgroundColor: colors.bgBase,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginBottom: 10,
                }}
              />
              {lookupError ? (
                <Text
                  style={{
                    fontFamily: Fonts.ui,
                    fontSize: 12,
                    color: colors.textTertiary,
                    marginBottom: 10,
                  }}
                >
                  {lookupError}
                </Text>
              ) : null}
              <View className="flex-row justify-end" style={{ gap: 10 }}>
                <Pressable
                  onPress={() => setMode('choose')}
                  className="px-4 py-2"
                  disabled={lookupBusy}
                >
                  <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textSecondary }}>
                    Back
                  </Text>
                </Pressable>
                <Pressable
                  onPress={submitUrl}
                  disabled={lookupBusy || !url.trim()}
                  className="px-4 py-2 rounded-full"
                  style={{
                    backgroundColor: url.trim() ? colors.brandUi : colors.bgDisabled,
                    opacity: lookupBusy ? 0.7 : 1,
                  }}
                >
                  {lookupBusy ? (
                    <ActivityIndicator color={colors.textOnBrand} size="small" />
                  ) : (
                    <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                      Find
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
    </SheetScaffold>
  )
}

// Single row in the chooser, extracted so the three options share their
// layout and the three Pressables in the parent stay readable.
function AddOption({
  Icon,
  label,
  subtitle,
  onPress,
  topBorder,
}: {
  Icon: React.ComponentType<{ color: string; size: number }>
  label: string
  subtitle: string
  onPress: () => void
  topBorder?: boolean
}) {
  const colors = useColors()
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-5 py-4"
      style={topBorder ? { borderTopWidth: 1, borderTopColor: colors.borderSubtle } : undefined}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: colors.brandSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Icon color={colors.brandUi} size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}>
          {label}
        </Text>
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  )
}

// URL → book matcher. Recognizes Gutenberg, Standard Ebooks, Goodreads, and
// Open Library links. For Gutenberg we have a direct ID column to match
// against; for the others we extract the title slug from the path and do an
// ilike search against the books table.
async function findBookFromUrl(input: string): Promise<{ id: string } | null> {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
  const segments = parsed.pathname.split('/').filter(Boolean)

  // Gutenberg, /ebooks/1342 or /files/1342/whatever
  if (host.endsWith('gutenberg.org')) {
    const num = segments.find((s) => /^\d+$/.test(s))
    if (num) {
      const id = Number(num)
      if (Number.isFinite(id)) {
        const { data } = await supabase
          .from('books')
          .select('id')
          .eq('gutenberg_id', id)
          .maybeSingle()
        if (data) return data as { id: string }
      }
    }
    // Fall through to slug-based search if /ebooks/1342 had a title slug too.
  }

  // Standard Ebooks, /ebooks/{author-slug}/{title-slug}
  // Open Library   , /works/OL...W/{Title_Slug}
  // Goodreads      , /book/show/{id}.{Title_Slug}  or  /book/show/{id}-title-slug
  // Use the last segment as the title source, normalize separators to spaces.
  let titleSlug = segments[segments.length - 1] ?? ''
  if (!titleSlug) return null

  if (host.endsWith('goodreads.com')) {
    // Strip the leading "{id}." or "{id}-" prefix.
    titleSlug = titleSlug.replace(/^\d+[._-]/, '')
  }

  const title = titleSlug
    .replace(/\.html?$/i, '')
    .replace(/[._-]+/g, ' ')
    .trim()
  if (!title) return null

  // Escape ilike wildcards so a title with literal _ or % matches faithfully.
  const escaped = title.replace(/([%_\\])/g, '\\$1')
  const { data } = await supabase
    .from('books')
    .select('id')
    .ilike('title', `%${escaped}%`)
    .limit(1)
  const match = ((data ?? [])[0] as { id?: string } | undefined)?.id
  return match ? { id: match } : null
}

// ── Row ──────────────────────────────────────────────────────────────────

function LibraryRow({
  row,
  showRating,
  editMode,
  selected,
  onToggleSelect,
  onOpen,
  onLongPress,
  onRatingChange,
  onReview,
  onReread,
  onResume,
}: {
  row: BookRow
  showRating: boolean
  editMode: boolean
  selected: boolean
  onToggleSelect: () => void
  onOpen: () => void
  onLongPress?: () => void
  onRatingChange: (rating: number) => void
  onReview: () => void
  onReread: () => void
  onResume: () => void
}) {
  const colors = useColors()
  const book = row.book
  return (
    <Pressable
      onPress={editMode ? onToggleSelect : onOpen}
      onLongPress={editMode ? undefined : onLongPress}
      delayLongPress={400}
      accessibilityRole={editMode ? 'checkbox' : 'button'}
      accessibilityState={editMode ? { checked: selected } : undefined}
      accessibilityLabel={
        editMode
          ? `${selected ? 'Deselect' : 'Select'} ${book?.title ?? 'book'}`
          : `Open ${book?.title ?? 'book'}`
      }
      className="flex-row mb-4 rounded-xl p-3 bg-bg-surface-light dark:bg-bg-surface-dark border border-border-subtle-light dark:border-border-subtle-dark"
      style={
        editMode && selected
          ? { borderColor: colors.borderBrand, backgroundColor: colors.bgSelected }
          : undefined
      }
    >
      {editMode ? (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? colors.brandUi : colors.borderInteractive,
            backgroundColor: selected ? colors.brandUi : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
            alignSelf: 'center',
          }}
        >
          {selected ? <Check color={colors.textOnBrand} size={12} weight="bold" /> : null}
        </View>
      ) : null}
      <View
        style={{
          width: 60,
          height: 90,
          borderRadius: 6,
          overflow: 'hidden',
          backgroundColor: colors.bgSunken,
          marginRight: 12,
        }}
      >
        {book?.cover_url ? (
          <Image
            source={{ uri: book.cover_url }}
            style={{ width: '100%', height: '100%' }}
            accessibilityRole="image"
            accessibilityLabel={`${book?.title ?? 'Book'} cover`}
          />
        ) : null}
        {row.status === 'paused' ? (
          <View
            style={{
              position: 'absolute',
              inset: 0 as never,
              backgroundColor: colors.scrimLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel="Paused"
          >
            <Pause color={colors.textOnDark} size={20} weight="fill" />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}
          numberOfLines={2}
        >
          {book?.title ?? ''}
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
          {book?.author ?? ''}
        </Text>
        {book?.series_name ? (
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 10,
              color: colors.brandText,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {book.series_name}
          </Text>
        ) : null}
        {row.status === 'paused' ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation()
              onResume()
            }}
            accessibilityRole="button"
            accessibilityLabel="Resume reading"
            className="flex-row items-center self-start mt-2 px-3 py-1 rounded-full"
            style={{ backgroundColor: colors.brandUi, gap: 4 }}
          >
            <Play color={colors.textOnBrand} size={11} weight="fill" />
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textOnBrand }}
            >
              Resume
            </Text>
          </Pressable>
        ) : null}
        {row.status === 'reading' ? (
          <View style={{ marginTop: 8 }}>
            <View
              style={{
                height: 3,
                borderRadius: 2,
                backgroundColor: colors.bgSunken,
              }}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(row.progress_percentage * 100),
              }}
            >
              <View
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: colors.brandUi,
                  width: `${Math.max(0, Math.min(100, row.progress_percentage * 100))}%`,
                }}
              />
            </View>
            <Text
              style={{
                fontFamily: Fonts.mono,
                fontSize: 11,
                color: colors.textTertiary,
                marginTop: 4,
              }}
            >
              {Math.round(row.progress_percentage * 100)}%
            </Text>
          </View>
        ) : null}
        {showRating ? (
          <View style={{ marginTop: 8 }}>
            <Stars value={row.rating_half ?? row.rating ?? 0} onChange={onRatingChange} />
            <View className="flex-row items-center gap-3" style={{ marginTop: 6 }}>
              <Pressable onPress={onReview} hitSlop={4}>
                <Text
                  style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandText }}
                >
                  {row.review ? 'Edit review' : 'Write review'}
                </Text>
              </Pressable>
              <Pressable onPress={onReread} hitSlop={4} className="flex-row items-center gap-1">
                <ArrowClockwise color={colors.brandText} size={11} />
                <Text
                  style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandText }}
                >
                  Read again
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

// ── Bulk edit helpers ────────────────────────────────────────────────────

function BulkActionButton({
  Icon,
  label,
  onPress,
  disabled,
  destructive,
}: {
  Icon: React.ComponentType<{ color: string; size: number; weight?: 'regular' | 'fill' }>
  label: string
  onPress: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  const colors = useColors()
  const tint = disabled ? colors.textTertiary : destructive ? colors.error : colors.brandText
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      className="items-center"
      style={{ paddingHorizontal: 10, paddingVertical: 6, opacity: disabled ? 0.4 : 1, flex: 1 }}
    >
      <Icon color={tint} size={20} />
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: tint,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function BulkShelfPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean
  onClose: () => void
  onPick: (status: UserBookStatus) => void | Promise<void>
}) {
  const colors = useColors()
  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      scroll={false}
      header={
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            paddingHorizontal: 20,
            marginBottom: 8,
          }}
        >
          Move to shelf
        </Text>
      }
    >
          {STATUS_SHELVES.map((s, i) => (
            <Pressable
              key={s.status}
              onPress={() => onPick(s.status)}
              accessibilityRole="button"
              accessibilityLabel={`Move to ${s.label}`}
              className="px-5 py-4"
              style={{
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.borderSubtle,
              }}
            >
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}>
                {s.label}
              </Text>
            </Pressable>
          ))}
    </SheetScaffold>
  )
}

function BulkRatePicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean
  onClose: () => void
  onPick: (rating: number) => void | Promise<void>
}) {
  const colors = useColors()
  const [draft, setDraft] = useState(0)
  useEffect(() => {
    if (visible) setDraft(0)
  }, [visible])
  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      scroll={false}
      contentContainerStyle={{ paddingHorizontal: 20 }}
      header={
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 10,
            paddingHorizontal: 20,
          }}
        >
          Rate selected books
        </Text>
      }
      footer={
        <View className="flex-row justify-end" style={{ gap: 10 }}>
          <Pressable onPress={onClose} className="px-4 py-2">
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textSecondary }}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onPick(draft)}
            disabled={draft === 0}
            className="px-4 py-2 rounded-full"
            style={{
              backgroundColor: draft > 0 ? colors.brandUi : colors.bgDisabled,
            }}
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
              Apply
            </Text>
          </Pressable>
        </View>
      }
    >
          <View className="flex-row justify-center" style={{ gap: 6, marginBottom: 16 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = n <= draft
              return (
                <Pressable
                  key={n}
                  onPress={() => setDraft(n === draft ? 0 : n)}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${n} ${n === 1 ? 'star' : 'stars'}`}
                  hitSlop={6}
                >
                  <Star
                    color={filled ? colors.brandSecondary : colors.textTertiary}
                    weight={filled ? 'fill' : 'regular'}
                    size={32}
                  />
                </Pressable>
              )
            })}
          </View>
    </SheetScaffold>
  )
}

// Renders 5 stars with half-star awareness. Each star has two tap zones.
// left half sets X.5, right half sets X. Tapping the currently-selected
// value clears the rating to 0. value is a 0..5 half-step float.
function Stars({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const colors = useColors()
  const STAR_SIZE = 18
  return (
    <View
      className="flex-row"
      style={{ gap: 2 }}
      accessibilityRole="radiogroup"
      accessibilityLabel={`Rating, ${value} of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n
        const half = !filled && value >= n - 0.5
        const Icon = filled ? Star : half ? StarHalf : Star
        const iconColor = filled || half ? colors.brandSecondary : colors.textTertiary
        const weight = filled || half ? 'fill' : 'regular'
        return (
          <View key={n} style={{ flexDirection: 'row', position: 'relative' }}>
            {/* Left tap zone, sets X.5 */}
            <Pressable
              onPress={() => onChange(value === n - 0.5 ? 0 : n - 0.5)}
              hitSlop={2}
              accessibilityRole="radio"
              accessibilityLabel={`${n - 0.5} stars`}
              accessibilityState={{ selected: half }}
              style={{ width: STAR_SIZE / 2, height: STAR_SIZE, zIndex: 1 }}
            />
            {/* Right tap zone, sets X */}
            <Pressable
              onPress={() => onChange(value === n ? 0 : n)}
              hitSlop={2}
              accessibilityRole="radio"
              accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
              accessibilityState={{ selected: filled }}
              style={{ width: STAR_SIZE / 2, height: STAR_SIZE, zIndex: 1 }}
            />
            {/* Star icon, rendered behind the tap zones so the visible star
                doesn't intercept presses meant for the half-zones. */}
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, top: 0, width: STAR_SIZE, height: STAR_SIZE }}
            >
              <Icon color={iconColor} weight={weight} size={STAR_SIZE} />
            </View>
          </View>
        )
      })}
    </View>
  )
}

// ── Create shelf modal ──────────────────────────────────────────────────

function CreateShelfModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean
  onClose: () => void
  onCreate: (name: string) => Promise<void> | void
}) {
  const colors = useColors()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setName('')
      setSaving(false)
    }
  }, [visible])

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      stickyFooter
      contentContainerStyle={{ paddingHorizontal: 16 }}
      header={
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 16,
            color: colors.textPrimary,
            marginBottom: 12,
            paddingHorizontal: 16,
          }}
        >
          New shelf
        </Text>
      }
      footer={
        <View className="flex-row justify-end gap-3">
          <Pressable onPress={onClose} className="px-4 py-2">
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textSecondary }}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              if (!name.trim() || saving) return
              setSaving(true)
              await onCreate(name.trim())
              setSaving(false)
              onClose()
            }}
            disabled={!name.trim() || saving}
            className="px-4 py-2 rounded-full"
            style={{
              backgroundColor: name.trim() ? colors.brandUi : colors.bgDisabled,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
              Create
            </Text>
          </Pressable>
        </View>
      }
    >
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name your shelf"
            placeholderTextColor={colors.textTertiary}
            maxLength={40}
            autoFocus
            style={{
              fontFamily: Fonts.body,
              fontSize: 15,
              color: colors.textPrimary,
              backgroundColor: colors.bgBase,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 12,
            }}
          />
    </SheetScaffold>
  )
}

// ── Review modal ────────────────────────────────────────────────────────

function ReviewModal({
  row,
  onClose,
  onSaved,
}: {
  row: BookRow
  onClose: () => void
  onSaved: (review: string, isPublic: boolean) => void
}) {
  const colors = useColors()
  const [text, setText] = useState(row.review ?? '')
  const [isPublic, setIsPublic] = useState(!!row.review_is_public)
  const [saving, setSaving] = useState(false)

  return (
    <SheetScaffold
      visible
      onClose={onClose}
      contentContainerStyle={{ padding: 16 }}
      header={
        <View className="flex-row items-center justify-between px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
            <XIcon color={colors.textPrimary} size={20} />
          </Pressable>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}>
            How was {row.book?.title ?? 'this book'}?
          </Text>
          <View style={{ width: 36 }} />
        </View>
      }
      footer={
        <View className="flex-row items-center justify-end">
          <Pressable
            onPress={async () => {
              setSaving(true)
              await saveReview(row.id, text, isPublic)
              setSaving(false)
              onSaved(text, isPublic)
            }}
            disabled={saving}
            className="px-5 py-2 rounded-full"
            style={{ backgroundColor: colors.brandUi, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? (
              <ActivityIndicator color={colors.textOnBrand} size="small" />
            ) : (
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                Save
              </Text>
            )}
          </Pressable>
        </View>
      }
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="280 chars max"
        placeholderTextColor={colors.textTertiary}
        maxLength={280}
        multiline
        style={{
          fontFamily: Fonts.body,
          fontSize: 15,
          color: colors.textPrimary,
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          borderRadius: 12,
          padding: 12,
          minHeight: 140,
          textAlignVertical: 'top',
        }}
      />
      <View
        className="flex-row items-center justify-between mt-3 p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
          Public on my profile
        </Text>
        <Switch
          value={isPublic}
          onValueChange={setIsPublic}
          trackColor={{ false: colors.bgDisabled, true: colors.brandUi }}
        />
      </View>
    </SheetScaffold>
  )
}
