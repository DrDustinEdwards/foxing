'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useSession } from '@/components/providers/session-provider'
import type { Bookmark } from '@/lib/bookmarks'
import type { ChapterReaction } from '@/lib/chapter-reactions-types'
import type { PublicChapterReaction } from '@/lib/chapter-reactions-types'
import { BookmarksSection } from './bookmarks-section'
import { BookTagsRow } from './book-tags-row'
import { BookShelvesPicker } from '@/components/shelves/book-shelves-picker'
import { ChapterReactionsSection } from './chapter-reactions-section'
import { CommunityReactionsSection } from './community-reactions-section'
import { ReadingTimerWidget } from '@/components/reading-timer-widget'

interface ShelfOption {
  id: string
  name: string
  is_public: boolean
}

interface UserBookStatus {
  status: string | null
  progress_percentage: number | null
}

interface MeBookState {
  loaded: boolean
  viewerId: string | null
  hasInLibrary: boolean
  bookmarks: Bookmark[]
  shelves: ShelfOption[]
  shelfMembership: string[]
  ownReactions: ChapterReaction[]
  ownTags: string[]
  userBookStatus: UserBookStatus | null
}

const EMPTY: MeBookState = {
  loaded: false,
  viewerId: null,
  hasInLibrary: false,
  bookmarks: [],
  shelves: [],
  shelfMembership: [],
  ownReactions: [],
  ownTags: [],
  userBookStatus: null,
}

const EMPTY_LOADED: MeBookState = { ...EMPTY, loaded: true }

const MeBookContext = createContext<MeBookState>(EMPTY)

export function MeBookProvider({
  bookId,
  children,
}: {
  bookId: string
  children: React.ReactNode
}) {
  const { user, isLoading } = useSession()
  const [state, setState] = useState<MeBookState>(EMPTY)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      setState(EMPTY_LOADED)
      return
    }
    let cancelled = false
    fetch(`/api/me/book/${bookId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setState({ loaded: true, ...(data as Omit<MeBookState, 'loaded'>) })
      })
      .catch(() => {
        if (!cancelled) setState(EMPTY_LOADED)
      })
    return () => {
      cancelled = true
    }
  }, [bookId, user, isLoading])

  return (
    <MeBookContext.Provider value={state}>{children}</MeBookContext.Provider>
  )
}

function useMeBook() {
  return useContext(MeBookContext)
}

interface BookRef {
  bookId: string
  bookSlug: string | null
}

export function PersonalizedReadingTimer({
  bookId,
  bookSlug,
  bookTitle,
  wordCount,
}: BookRef & {
  bookTitle: string
  wordCount: number | null
}) {
  const { viewerId, loaded } = useMeBook()
  if (!loaded || !viewerId) return null
  return (
    <ReadingTimerWidget
      bookId={bookId}
      bookSlug={bookSlug}
      bookTitle={bookTitle}
      wordCount={wordCount}
    />
  )
}

export function PersonalizedBookmarks({ bookId, bookSlug }: BookRef) {
  const { viewerId, hasInLibrary, bookmarks, loaded } = useMeBook()
  if (!loaded || !viewerId || !hasInLibrary) return null
  return (
    <BookmarksSection
      bookmarks={bookmarks}
      bookId={bookId}
      bookSlug={bookSlug}
    />
  )
}

export function PersonalizedBookTagsBox({ bookId, bookSlug }: BookRef) {
  const { viewerId, hasInLibrary, ownTags, loaded } = useMeBook()
  if (!loaded || !viewerId || !hasInLibrary) return null
  return (
    <div className="mt-6 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <BookTagsRow
        bookId={bookId}
        bookSlug={bookSlug}
        initialTags={ownTags}
      />
    </div>
  )
}

export function PersonalizedBookShelvesBox({ bookId }: { bookId: string }) {
  const { viewerId, shelves, shelfMembership, loaded } = useMeBook()
  if (!loaded || !viewerId) return null
  return (
    <div className="mt-6 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <BookShelvesPicker
        bookId={bookId}
        shelves={shelves}
        initialMembership={shelfMembership}
      />
    </div>
  )
}

export function PersonalizedChapterReactions({ bookId, bookSlug }: BookRef) {
  const { viewerId, ownReactions, loaded } = useMeBook()
  if (!loaded || !viewerId) return null
  return (
    <ChapterReactionsSection
      bookId={bookId}
      bookSlug={bookSlug}
      reactions={ownReactions}
    />
  )
}

export function CommunityReactionsWithViewer({
  reactions,
}: {
  reactions: PublicChapterReaction[]
}) {
  const { hasInLibrary, userBookStatus } = useMeBook()
  const mapped = useMemo(
    () =>
      reactions.map((r) => ({
        id: r.id,
        chapter_name: r.chapter_name,
        emoji: r.emoji,
        note: r.note,
        created_at: r.created_at,
        author: r.author,
      })),
    [reactions],
  )
  return (
    <CommunityReactionsSection
      reactions={mapped}
      inLibrary={hasInLibrary}
      progressPercentage={userBookStatus?.progress_percentage ?? null}
    />
  )
}
