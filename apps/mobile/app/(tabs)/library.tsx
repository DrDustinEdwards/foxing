import { useCreateShelf, useDeleteShelf, useLibrary, useSetBookStatus, useShelf, useShelves } from '@foxing/client'
import type * as W from '@foxing/types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Plus, CaretDown, Check, Trash, ArrowsLeftRight, PencilSimple } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { ShelfTabs } from '@/components/library/shelf-tabs'
import { LibraryEmptyState } from '@/components/library/library-empty-state'
import { AddBookSheet } from '@/components/library/add-book-sheet'
import { LibraryRow } from '@/components/library/library-row'
import { BulkActionButton, BulkShelfPicker } from '@/components/library/bulk-actions'
import { CreateShelfModal } from '@/components/library/library-modals'
import { type BookRow, SORT_OPTIONS, type ShelfKey, type SortKey } from '@/components/library/library-types'

// The reader's library: status shelves from GET /library and their own shelves from
// /shelves. Every change patches the cached library, so the list updates in place.
export default function Library() {
  const colors = useColors()
  const router = useRouter()
  const library = useLibrary()
  const shelves = useShelves().data ?? []
  const createShelf = useCreateShelf()
  const deleteShelf = useDeleteShelf()
  const setBookStatus = useSetBookStatus()
  const [activeShelf, setActiveShelf] = useState<ShelfKey>({
    kind: 'status',
    status: 'reading',
    label: 'Reading',
  })
  const customShelf = useShelf(activeShelf.kind === 'custom' ? activeShelf.shelfId : '')
  const [createShelfOpen, setCreateShelfOpen] = useState(false)
  const [sort, setSort] = useState<SortKey>('updated')
  const [sortPickerOpen, setSortPickerOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)

  // Bulk edit mode; the selection holds book ids.
  const [editMode, setEditMode] = useState(false)
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set())
  const [bulkShelfPickerOpen, setBulkShelfPickerOpen] = useState(false)

  const entries = library.data ?? []
  const books = useMemo<BookRow[]>(() => {
    if (activeShelf.kind === 'status') return entries.filter((e) => e.status === activeShelf.status)
    const byId = new Map(entries.map((e) => [e.bookId, e]))
    return (customShelf.data?.books ?? []).map((b) => {
      const e = byId.get(b.id)
      return {
        bookId: b.id,
        slug: b.slug,
        title: b.title,
        author: b.author,
        coverUrl: b.coverUrl,
        status: e?.status ?? null,
        progressPct: e?.progressPct ?? 0,
        updatedAt: e?.updatedAt ?? 0,
      }
    })
  }, [activeShelf, entries, customShelf.data])
  const loading = activeShelf.kind === 'status' ? library.isPending : customShelf.isPending

  const visible = useMemo(() => {
    const list = [...books]
    list.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'author') return a.author.localeCompare(b.author)
      return b.updatedAt - a.updatedAt
    })
    return list
  }, [books, sort])

  const onCreateShelf = useCallback(
    async (name: string) => {
      const shelf = (await createShelf.run({ name }))?.shelf
      if (shelf) setActiveShelf({ kind: 'custom', shelfId: shelf.id, label: shelf.name })
    },
    [createShelf],
  )

  const setStatus = useCallback(
    (row: BookRow, status: W.ShelfStatus | null) =>
      setBookStatus.fire({ bookId: row.bookId, status, book: { ...row, id: row.bookId } }),
    [setBookStatus],
  )

  // ── Bulk edit ─────────────────────────────────────────────────────────

  const exitBulkEdit = useCallback(() => {
    setEditMode(false)
    setSelectedBookIds(new Set())
  }, [])

  const toggleSelected = useCallback((bookId: string) => {
    setSelectedBookIds((prev) => {
      const next = new Set(prev)
      if (next.has(bookId)) next.delete(bookId)
      else next.add(bookId)
      return next
    })
  }, [])

  const onSelectAll = useCallback(() => {
    setSelectedBookIds((prev) => {
      if (prev.size === books.length && books.length > 0) {
        return new Set()
      }
      return new Set(books.map((b) => b.bookId))
    })
  }, [books])

  const bulkSet = useCallback(
    (status: W.ShelfStatus | null) => {
      for (const row of books) if (selectedBookIds.has(row.bookId)) setStatus(row, status)
      setBulkShelfPickerOpen(false)
      exitBulkEdit()
    },
    [books, exitBulkEdit, selectedBookIds, setStatus],
  )

  const bulkDelete = useCallback(() => {
    const n = selectedBookIds.size
    if (n === 0) return
    Alert.alert(
      `Remove ${n} book${n === 1 ? '' : 's'}?`,
      "They'll be removed from your library. You can re-add them anytime.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => bulkSet(null) },
      ],
    )
  }, [bulkSet, selectedBookIds])

  // Exit edit mode when the active shelf changes, feels intuitive and
  // avoids the user's selection silently spanning a different list.
  useEffect(() => {
    if (editMode) exitBulkEdit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShelf])

  const onLongPressShelf = useCallback(
    (shelf: W.Shelf) => {
      Alert.alert(shelf.name, undefined, [
        {
          text: 'Delete shelf',
          style: 'destructive',
          onPress: () => {
            deleteShelf.fire({ id: shelf.id })
            if (activeShelf.kind === 'custom' && activeShelf.shelfId === shelf.id) {
              setActiveShelf({ kind: 'status', status: 'reading', label: 'Reading' })
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ])
    },
    [activeShelf, deleteShelf],
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
              key={entry.bookId}
              row={entry}
              editMode={editMode}
              selected={selectedBookIds.has(entry.bookId)}
              onToggleSelect={() => toggleSelected(entry.bookId)}
              onOpen={() => router.push(`/reader/${entry.bookId}` as never)}
              onLongPress={() => {
                router.push({
                  pathname: '/quote-card',
                  params: {
                    type: 'reading',
                    bookId: entry.bookId,
                    bookTitle: entry.title,
                    author: entry.author,
                    coverUrl: entry.coverUrl ?? '',
                    progress: String(entry.progressPct / 100),
                  },
                } as never)
              }}
              onReread={() => {
                setStatus(entry, 'reading')
                router.push(`/reader/${entry.bookId}` as never)
              }}
              onResume={() => setStatus(entry, 'reading')}
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
        onPick={bulkSet}
      />

      <AddBookSheet
        visible={fabOpen}
        onClose={() => setFabOpen(false)}
        onBrowse={() => {
          setFabOpen(false)
          router.push('/(tabs)' as never)
        }}
        onMatch={(slug) => {
          setFabOpen(false)
          router.push(`/book/${slug}` as never)
        }}
      />
    </SafeAreaView>
  )
}
