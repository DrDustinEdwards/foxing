import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  CustomShelfRow,
  CustomShelfWithBooks,
  CustomShelfWithCount,
  ShelfBook,
} from '@/lib/shelves-types'

export type {
  CustomShelfRow,
  CustomShelfWithBooks,
  CustomShelfWithCount,
  ShelfBook,
} from '@/lib/shelves-types'

const ROW_COLS =
  'id, user_id, name, description, is_public, position, created_at, updated_at' as const

export async function fetchUserShelves(
  userId: string,
): Promise<CustomShelfWithCount[]> {
  const sb = createClient()
  const { data } = await sb
    .from('custom_shelves')
    .select(ROW_COLS)
    .eq('user_id', userId)
    .order('position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  const shelves = (data as CustomShelfRow[] | null) ?? []
  if (shelves.length === 0) return []
  const ids = shelves.map((s) => s.id)
  const { data: countRows } = await sb
    .from('custom_shelf_books')
    .select('shelf_id')
    .in('shelf_id', ids)
  const counts = new Map<string, number>()
  for (const r of (countRows as { shelf_id: string }[] | null) ?? []) {
    counts.set(r.shelf_id, (counts.get(r.shelf_id) ?? 0) + 1)
  }
  return shelves.map((s) => ({ ...s, book_count: counts.get(s.id) ?? 0 }))
}

export async function fetchUserShelvesForBook(
  userId: string,
  bookId: string,
): Promise<{
  shelves: CustomShelfWithCount[]
  membership: Set<string>
}> {
  const sb = createClient()
  const [shelvesRes, membershipRes] = await Promise.all([
    fetchUserShelves(userId),
    sb
      .from('custom_shelf_books')
      .select('shelf_id')
      .eq('book_id', bookId),
  ])
  const membership = new Set(
    ((membershipRes.data as { shelf_id: string }[] | null) ?? []).map(
      (r) => r.shelf_id,
    ),
  )
  return { shelves: shelvesRes, membership }
}

export async function fetchShelfForOwner(
  userId: string,
  shelfId: string,
): Promise<CustomShelfWithBooks | null> {
  const sb = createClient()
  const { data: shelf } = await sb
    .from('custom_shelves')
    .select(ROW_COLS)
    .eq('id', shelfId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!shelf) return null
  const books = await fetchShelfBooks(shelfId)
  return { ...(shelf as CustomShelfRow), books }
}

export async function fetchPublicShelf(
  shelfId: string,
): Promise<(CustomShelfWithBooks & { owner_username: string }) | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('custom_shelves')
    .select(
      `${ROW_COLS}, owner:user_id(username, display_name)`,
    )
    .eq('id', shelfId)
    .eq('is_public', true)
    .maybeSingle()
  if (!data) return null
  const row = data as unknown as CustomShelfRow & {
    owner: { username: string; display_name: string } | null
  }
  if (!row.owner) return null
  const books = await fetchShelfBooks(shelfId, true)
  return { ...row, books, owner_username: row.owner.username }
}

export async function fetchPublicShelvesForUser(
  userId: string,
): Promise<CustomShelfWithCount[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('custom_shelves')
    .select(ROW_COLS)
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('position', { ascending: true, nullsFirst: false })
  const shelves = (data as CustomShelfRow[] | null) ?? []
  if (shelves.length === 0) return []
  const ids = shelves.map((s) => s.id)
  const { data: countRows } = await admin
    .from('custom_shelf_books')
    .select('shelf_id')
    .in('shelf_id', ids)
  const counts = new Map<string, number>()
  for (const r of (countRows as { shelf_id: string }[] | null) ?? []) {
    counts.set(r.shelf_id, (counts.get(r.shelf_id) ?? 0) + 1)
  }
  return shelves.map((s) => ({ ...s, book_count: counts.get(s.id) ?? 0 }))
}

async function fetchShelfBooks(
  shelfId: string,
  usePublicClient = false,
): Promise<ShelfBook[]> {
  const client = usePublicClient ? createAdminClient() : createClient()
  const { data } = await client
    .from('custom_shelf_books')
    .select(
      'added_at, book:book_id(id, slug, title, author, cover_url)',
    )
    .eq('shelf_id', shelfId)
    .order('added_at', { ascending: false })
  const rows =
    (data as unknown as Array<{
      added_at: string
      book: ShelfBook | null
    }> | null) ?? []
  return rows
    .map((r) => r.book)
    .filter((b): b is ShelfBook => b !== null)
}
