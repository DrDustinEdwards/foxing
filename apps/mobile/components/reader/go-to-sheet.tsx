import { useCallback, useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X as XIcon, Trash, BookmarkSimple, ListBullets, NavigationArrow, MapPin } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { deleteBookmark, listBookmarks, type BookmarkRow } from '@/lib/bookmarks'
import type { PositionEntry } from '@/lib/position-history'

type Tab = 'contents' | 'location' | 'places'

interface TocItem {
  label: string
  href: string
  cfi: string | null
}

interface GoToSheetProps {
  visible: boolean
  bookId: string
  // Current position percentage (0..1), used to prefill the location slider.
  currentProgress: number
  // Lazy-loaded TOC + bookmarks fetched by the host on open.
  loadToc: () => Promise<TocItem[]>
  // Lazy-loaded position history. The host owns the canonical list (kept in a
  // ref mid-session); we just snapshot it each time the sheet opens.
  loadHistory?: () => Promise<PositionEntry[]>
  // Clear all history entries for this book.
  onClearHistory?: () => Promise<void> | void
  onNavigateCfi: (cfi: string) => void
  onNavigatePercent: (percent: number) => void
  // Reader resolves href → CFI internally via goToCfi if href is a CFI; the
  // host can also accept hrefs and pass them through to renderer.goTo.
  onNavigateHref?: (href: string) => void
  onClose: () => void
}

export function GoToSheet({
  visible,
  bookId,
  currentProgress,
  loadToc,
  loadHistory,
  onClearHistory,
  onNavigateCfi,
  onNavigatePercent,
  onNavigateHref,
  onClose,
}: GoToSheetProps) {
  const colors = useColors()
  const [tab, setTab] = useState<Tab>('contents')
  const [toc, setToc] = useState<TocItem[]>([])
  const [tocLoading, setTocLoading] = useState(false)
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([])
  const [bookmarksLoading, setBookmarksLoading] = useState(false)
  const [percent, setPercent] = useState<string>('0')
  const [history, setHistory] = useState<PositionEntry[]>([])

  useEffect(() => {
    if (!visible) return
    setTab('contents')
    setPercent(String(Math.round(currentProgress * 100)))
    setTocLoading(true)
    loadToc()
      .then((items) => setToc(items))
      .catch(() => setToc([]))
      .finally(() => setTocLoading(false))
    setBookmarksLoading(true)
    listBookmarks(bookId)
      .then(setBookmarks)
      .finally(() => setBookmarksLoading(false))
    if (loadHistory) {
      loadHistory().then(setHistory).catch(() => setHistory([]))
    } else {
      setHistory([])
    }
  }, [visible, bookId, currentProgress, loadToc, loadHistory])

  const onGoToPercent = useCallback(() => {
    const n = parseFloat(percent)
    if (!Number.isFinite(n)) return
    const clamped = Math.max(0, Math.min(100, n))
    onNavigatePercent(clamped / 100)
    onClose()
  }, [onClose, onNavigatePercent, percent])

  const onDeleteBookmark = useCallback(
    (b: BookmarkRow) => {
      Alert.alert('Delete bookmark?', b.name ?? 'Bookmark', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteBookmark(b.id)
            if (ok) setBookmarks((prev) => prev.filter((x) => x.id !== b.id))
          },
        },
      ])
    },
    [],
  )

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark" edges={['top']}>
        <View className="flex-row items-center justify-between px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
            <XIcon color={colors.textPrimary} size={20} />
          </Pressable>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}>
            Go to
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <View className="flex-row px-2 mb-2">
          <TabButton tab="contents" current={tab} setTab={setTab} icon={ListBullets} label="Contents" />
          <TabButton tab="location" current={tab} setTab={setTab} icon={NavigationArrow} label="Location" />
          <TabButton tab="places" current={tab} setTab={setTab} icon={MapPin} label="My Places" />
        </View>

        {tab === 'contents' ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}>
            {tocLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={colors.brandUi} />
              </View>
            ) : toc.length === 0 ? (
              <EmptyText>No table of contents available.</EmptyText>
            ) : (
              toc.map((t, i) => (
                <Pressable
                  key={`${i}:${t.href}`}
                  onPress={() => {
                    // Prefer CFI if foliate gave us one; otherwise pass href to renderer.
                    if (t.cfi) onNavigateCfi(t.cfi)
                    else onNavigateHref?.(t.href)
                    onClose()
                  }}
                  className="px-3 py-3 rounded-lg"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderSubtle,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 14,
                      color: colors.textPrimary,
                    }}
                    numberOfLines={2}
                  >
                    {t.label || '(untitled)'}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        ) : tab === 'location' ? (
          <View style={{ padding: 16 }}>
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 11,
                color: colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 8,
              }}
            >
              Jump to percentage
            </Text>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <TextInput
                value={percent}
                onChangeText={setPercent}
                keyboardType="number-pad"
                style={{
                  flex: 1,
                  fontFamily: Fonts.mono,
                  fontSize: 18,
                  color: colors.textPrimary,
                  backgroundColor: colors.bgSurface,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  textAlign: 'center',
                }}
                maxLength={3}
              />
              <Text style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textTertiary }}>
                %
              </Text>
              <Pressable
                onPress={onGoToPercent}
                className="px-4 py-2 rounded-full"
                style={{ backgroundColor: colors.brandUi }}
              >
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand, fontSize: 13 }}>
                  Go
                </Text>
              </Pressable>
            </View>

            {/* Custom slider, overlay-track + draggable thumb via PanResponder
                would be more polished. For v1 we use a row of quick-pick
                presets below the input as the "slider" surrogate. */}
            <View className="flex-row" style={{ gap: 6, marginTop: 12 }}>
              {[0, 10, 25, 50, 75, 90].map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPercent(String(p))}
                  className="flex-1 items-center py-2 rounded-lg"
                  style={{
                    backgroundColor: parseFloat(percent) === p ? colors.bgSelected : colors.bgSurface,
                    borderWidth: 1,
                    borderColor: parseFloat(percent) === p ? colors.borderBrand : colors.borderSubtle,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.mono,
                      fontSize: 11,
                      color: colors.textSecondary,
                    }}
                  >
                    {p}%
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 11,
                color: colors.textTertiary,
                marginTop: 10,
              }}
            >
              Currently at {Math.round(currentProgress * 100)}%.
            </Text>
          </View>
        ) : (
          <MyPlacesTab
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            historyEntries={history}
            onNavigateCfi={(cfi) => {
              onNavigateCfi(cfi)
              onClose()
            }}
            onDeleteBookmark={onDeleteBookmark}
            onClearHistory={async () => {
              await onClearHistory?.()
              setHistory([])
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

// "My Places" merges bookmarks and recent history per task.md Section 2d.
// Bookmarks section first (curated by the user), then Recent (auto-built).
function MyPlacesTab({
  bookmarks,
  bookmarksLoading,
  historyEntries,
  onNavigateCfi,
  onDeleteBookmark,
  onClearHistory,
}: {
  bookmarks: BookmarkRow[]
  bookmarksLoading: boolean
  historyEntries: PositionEntry[]
  onNavigateCfi: (cfi: string) => void
  onDeleteBookmark: (b: BookmarkRow) => void
  onClearHistory: () => void | Promise<void>
}) {
  const colors = useColors()
  // Most recent first, capped at 20 even though the underlying list goes to 50.
  const recent = [...historyEntries].reverse().slice(0, 20)
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}>
      <SectionHeader>Bookmarks</SectionHeader>
      {bookmarksLoading ? (
        <View style={{ paddingVertical: 16, alignItems: 'center' }}>
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : bookmarks.length === 0 ? (
        <EmptyText>No bookmarks yet. Tap the bookmark icon in the top bar to add one.</EmptyText>
      ) : (
        bookmarks.map((b) => (
          <View
            key={b.id}
            className="flex-row items-center mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <Pressable
              onPress={() => onNavigateCfi(b.cfi)}
              className="flex-row items-center p-3"
              style={{ flex: 1 }}
              accessibilityRole="button"
              accessibilityLabel={`Go to bookmark ${b.name ?? 'unnamed'}`}
            >
              <BookmarkSimple color={colors.brandUi} size={16} weight="fill" />
              <Text
                style={{
                  flex: 1,
                  fontFamily: Fonts.uiMedium,
                  fontSize: 14,
                  color: colors.textPrimary,
                  marginLeft: 10,
                }}
                numberOfLines={2}
              >
                {b.name ?? 'Bookmark'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onDeleteBookmark(b)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Delete bookmark"
              style={{ padding: 12 }}
            >
              <Trash color={colors.textTertiary} size={16} />
            </Pressable>
          </View>
        ))
      )}

      <View style={{ height: 14 }} />

      <SectionHeader>Recent</SectionHeader>
      {recent.length === 0 ? (
        <EmptyText>No reading history yet. Turn a page to start building one.</EmptyText>
      ) : (
        <>
          {recent.map((e, i) => (
            <Pressable
              key={`${e.cfi}:${i}`}
              onPress={() => onNavigateCfi(e.cfi)}
              accessibilityRole="button"
              accessibilityLabel={`Go to ${e.chapter || 'previous position'} at ${Math.round(e.progress * 100)} percent`}
              className="px-3 py-3 rounded-lg"
              style={{
                borderBottomWidth: 1,
                borderBottomColor: colors.borderSubtle,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 14,
                  color: colors.textPrimary,
                }}
                numberOfLines={1}
              >
                {e.chapter || 'Unknown chapter'}
              </Text>
              <View className="flex-row items-center" style={{ marginTop: 4 }}>
                <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.textTertiary, flex: 1 }}>
                  {Math.round(e.progress * 100)}%
                </Text>
                <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>
                  {timeAgoShort(e.timestamp)}
                </Text>
              </View>
            </Pressable>
          ))}
          <Pressable
            onPress={() => onClearHistory()}
            className="flex-row items-center justify-center mt-3 py-3 rounded-lg"
            accessibilityRole="button"
            accessibilityLabel="Clear reading history"
            style={{ borderWidth: 1, borderColor: colors.borderSubtle }}
          >
            <Trash color={colors.textTertiary} size={14} />
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: colors.textTertiary,
                marginLeft: 6,
              }}
            >
              Clear history
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <Text
      style={{
        fontFamily: Fonts.uiMedium,
        fontSize: 11,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 8,
        paddingHorizontal: 4,
      }}
    >
      {children}
    </Text>
  )
}

function timeAgoShort(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function TabButton({
  tab,
  current,
  setTab,
  icon: Icon,
  label,
}: {
  tab: Tab
  current: Tab
  setTab: (t: Tab) => void
  icon: React.ComponentType<{ color: string; size: number }>
  label: string
}) {
  const colors = useColors()
  const active = tab === current
  return (
    <Pressable
      onPress={() => setTab(tab)}
      className="flex-1 items-center py-2"
      style={{
        borderBottomWidth: 2,
        borderBottomColor: active ? colors.borderInteractive : colors.borderSubtle,
      }}
    >
      <View className="flex-row items-center gap-1">
        <Icon color={active ? colors.brandText : colors.textTertiary} size={14} />
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 12,
            color: active ? colors.brandText : colors.textTertiary,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <Text
      style={{
        fontFamily: Fonts.ui,
        fontSize: 13,
        color: colors.textTertiary,
        textAlign: 'center',
        padding: 24,
      }}
    >
      {children}
    </Text>
  )
}
