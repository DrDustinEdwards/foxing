// The reader's offline-first writes. Highlights, notes, bookmarks, words, shelf moves,
// reading position and sessions all go through the sync queue (lib/sync-queue.ts), so
// reading on a plane loses nothing. Annotation writes also patch the book's cached
// layers straight away, the same cache the web reader's hooks patch, so the page and
// every sheet show the change before the queue flushes.
import { keys, useBookAnnotations } from '@foxing/client'
import type * as W from '@foxing/types'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { encodeLocator } from '@/components/reader/readium-helpers'
import { queueWrite } from './api'
import { clientId } from './sync-queue'

export interface NewMine {
  type: 'highlight' | 'note' | 'bookmark' | 'commonplace'
  locator: W.Locator | null
  selectedText?: string | null
  body?: string | null
  color?: string | null
  chapter?: string | null
  visibility?: 'private' | 'friends' | 'club' | 'public'
}

export function useReaderWrites(bookId: string | null) {
  const qc = useQueryClient()
  return useMemo(() => {
    const patchMine = (update: (mine: W.ReaderMine[]) => W.ReaderMine[]) => {
      if (!bookId) return
      qc.setQueryData<W.ReaderAnnotations>(keys.annotations(bookId), (l) =>
        l ? { ...l, mine: update(l.mine) } : l,
      )
    }
    return {
      /** Saves a highlight, note or bookmark; returns its id. */
      addAnnotation(a: NewMine): string | null {
        if (!bookId) return null
        const id = clientId()
        patchMine((mine) => [
          ...mine,
          {
            id,
            type: a.type,
            locator: a.locator,
            selectedText: a.selectedText ?? null,
            body: a.body ?? null,
            color: a.color ?? null,
            chapter: a.chapter ?? null,
          },
        ])
        void queueWrite({ id, resource: 'annotation', verb: 'create', payload: { bookId, ...a } })
        return id
      },
      removeAnnotation(id: string) {
        patchMine((mine) => mine.filter((m) => m.id !== id))
        void queueWrite({ id, resource: 'annotation', verb: 'delete' })
      },
      /** Shelf state and position; the server keys these by book. */
      saveBook(fields: {
        status?: W.ShelfStatus
        progress?: W.Locator | null
        progressPct?: number
        startedAt?: number | null
        finishedAt?: number | null
      }) {
        if (!bookId) return
        void queueWrite({ resource: 'user_book', verb: 'update', payload: { bookId, ...fields } })
      },
      /** One stretch of reading; sessions are append-only, so each stretch is its own row. */
      logSession(s: { startedAt: number; endedAt: number; pagesRead: number; avgWpm?: number | null; lastWpm?: number | null }) {
        if (!bookId) return
        void queueWrite({ resource: 'session', verb: 'create', payload: { bookId, ...s } })
      },
      saveWord(w: { word: string; definition: string; contextSentence?: string | null; aiContext?: string | null }) {
        void queueWrite({
          resource: 'vocabulary',
          verb: 'create',
          payload: { bookId, lookedUpAt: Date.now(), ...w },
        })
      },
    }
  }, [qc, bookId])
}

export interface BookmarkRow {
  id: string
  /** The encoded locator, the reader's position currency. */
  cfi: string
  name: string | null
}

/** The reader's bookmarks in a book: bookmark annotations from the cached layers. */
export function useBookmarks(bookId: string | null): { bookmarks: BookmarkRow[]; loading: boolean } {
  const layers = useBookAnnotations(bookId ?? '')
  const mine = layers.data?.mine
  const bookmarks = useMemo(
    () =>
      (mine ?? [])
        .filter((m) => m.type === 'bookmark' && m.locator)
        .map((m) => ({ id: m.id, cfi: encodeLocator(m.locator as W.Locator), name: m.body })),
    [mine],
  )
  return { bookmarks, loading: layers.isPending }
}
