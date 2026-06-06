import { NextResponse } from 'next/server'
import {
  fetchUserBookStatus,
  fetchUserBookmarks,
  fetchUserBookTags,
  userHasBookInLibrary,
} from '@/lib/bookmarks'
import { fetchOwnChapterReactions } from '@/lib/chapter-reactions'
import { getAuthedUserId } from '@/lib/nav-user'
import { fetchUserShelvesForBook } from '@/lib/shelves'

export const dynamic = 'force-dynamic'

const EMPTY_BODY = {
  viewerId: null,
  hasInLibrary: false,
  bookmarks: [],
  shelves: [],
  shelfMembership: [],
  ownReactions: [],
  ownTags: [],
  userBookStatus: null,
}

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const viewerId = await getAuthedUserId()
  if (!viewerId) {
    return NextResponse.json(EMPTY_BODY, { headers: PRIVATE_HEADERS })
  }
  const [
    hasInLibrary,
    bookmarks,
    shelvesData,
    ownReactions,
    ownTags,
    userBookStatus,
  ] = await Promise.all([
    userHasBookInLibrary(viewerId, id),
    fetchUserBookmarks(viewerId, id),
    fetchUserShelvesForBook(viewerId, id),
    fetchOwnChapterReactions(viewerId, id),
    fetchUserBookTags(viewerId, id),
    fetchUserBookStatus(viewerId, id),
  ])
  return NextResponse.json(
    {
      viewerId,
      hasInLibrary,
      bookmarks,
      shelves: shelvesData.shelves.map((s) => ({
        id: s.id,
        name: s.name,
        is_public: s.is_public,
      })),
      shelfMembership: [...shelvesData.membership],
      ownReactions,
      ownTags,
      userBookStatus,
    },
    { headers: PRIVATE_HEADERS },
  )
}
