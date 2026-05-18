'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/nav-user'

interface CreatePayload {
  club_id: string
  book_id: string
  pick_month: number
  pick_year: number
  category: string | null
  official_url: string | null
  notes: string | null
  is_published: boolean
}

function parseCreate(formData: FormData): CreatePayload {
  const club_id = String(formData.get('club_id') ?? '').trim()
  const book_id = String(formData.get('book_id') ?? '').trim()
  const pick_year = Number(formData.get('pick_year') ?? 0)
  const pick_month = Number(formData.get('pick_month') ?? 0)
  const category = String(formData.get('category') ?? '').trim() || null
  const official_url = String(formData.get('official_url') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 500) || null
  const is_published = formData.get('is_published') === 'on'
  return {
    club_id,
    book_id,
    pick_month,
    pick_year,
    category,
    official_url,
    notes,
    is_published,
  }
}

export async function createCelebrityPick(formData: FormData): Promise<void> {
  const payload = parseCreate(formData)
  if (
    !payload.club_id ||
    !payload.book_id ||
    !payload.pick_year ||
    !payload.pick_month
  ) {
    throw new Error('club, book, month, and year are required')
  }
  const picked_at = `${payload.pick_year}-${String(payload.pick_month).padStart(2, '0')}-01`
  const admin = createAdminClient()
  const { error } = await admin.from('external_book_club_picks').insert({
    club_id: payload.club_id,
    book_id: payload.book_id,
    picked_at,
    pick_month: payload.pick_month,
    pick_year: payload.pick_year,
    category: payload.category,
    official_url: payload.official_url,
    notes: payload.notes,
    is_published: payload.is_published,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/celebrity-picks')
  revalidatePath('/book-clubs')
  redirect('/admin/celebrity-picks')
}

export async function deleteCelebrityPick(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) throw new Error('id is required')
  const admin = createAdminClient()
  await admin.from('external_book_club_picks').delete().eq('id', id)
  revalidatePath('/admin/celebrity-picks')
  revalidatePath('/book-clubs')
}

interface PickEditResult {
  ok: boolean
  error?: string
}

/**
 * Edit a pick in place. Updates the underlying book row when the title or
 * author changes, updates the pick row, and writes one row per changed
 * field to external_book_club_pick_edits as an audit trail.
 */
export async function updateCelebrityPick(
  formData: FormData,
): Promise<PickEditResult> {
  const pickId = String(formData.get('pick_id') ?? '').trim()
  if (!pickId) return { ok: false, error: 'pick_id is required' }

  const editorId = await getAuthedUserId()
  const admin = createAdminClient()

  // Pull existing pick + book so we can compare and audit each field.
  const { data: existing, error: existingError } = await admin
    .from('external_book_club_picks')
    .select(
      'id, book_id, club_id, pick_month, pick_year, curator_quote, official_announcement_url, books:book_id(title, author)',
    )
    .eq('id', pickId)
    .maybeSingle()
  if (existingError) return { ok: false, error: existingError.message }
  if (!existing) return { ok: false, error: 'Pick not found.' }

  const row = existing as unknown as {
    id: string
    book_id: string
    club_id: string
    pick_month: number | null
    pick_year: number | null
    curator_quote: string | null
    official_announcement_url: string | null
    books: { title: string; author: string } | null
  }

  const newTitle = String(formData.get('book_title') ?? '').trim()
  const newAuthor = String(formData.get('book_author') ?? '').trim()
  const newQuote = String(formData.get('curator_quote') ?? '').trim() || null
  const newUrl =
    String(formData.get('official_announcement_url') ?? '').trim() || null

  if (!newTitle || !newAuthor) {
    return { ok: false, error: 'Title and author are required.' }
  }

  const edits: Array<{
    pick_id: string
    edited_by: string | null
    field: string
    old_value: string | null
    new_value: string | null
  }> = []

  // Book title / author live on the books row, not the pick row.
  const currentTitle = row.books?.title ?? ''
  const currentAuthor = row.books?.author ?? ''
  if (newTitle !== currentTitle || newAuthor !== currentAuthor) {
    const { error: bookErr } = await admin
      .from('books')
      .update({ title: newTitle, author: newAuthor })
      .eq('id', row.book_id)
    if (bookErr) return { ok: false, error: bookErr.message }
    if (newTitle !== currentTitle) {
      edits.push({
        pick_id: row.id,
        edited_by: editorId,
        field: 'book_title',
        old_value: currentTitle,
        new_value: newTitle,
      })
    }
    if (newAuthor !== currentAuthor) {
      edits.push({
        pick_id: row.id,
        edited_by: editorId,
        field: 'book_author',
        old_value: currentAuthor,
        new_value: newAuthor,
      })
    }
  }

  if ((row.curator_quote ?? null) !== newQuote) {
    edits.push({
      pick_id: row.id,
      edited_by: editorId,
      field: 'curator_quote',
      old_value: row.curator_quote,
      new_value: newQuote,
    })
  }
  if ((row.official_announcement_url ?? null) !== newUrl) {
    edits.push({
      pick_id: row.id,
      edited_by: editorId,
      field: 'official_announcement_url',
      old_value: row.official_announcement_url,
      new_value: newUrl,
    })
  }

  const { error: pickErr } = await admin
    .from('external_book_club_picks')
    .update({
      curator_quote: newQuote,
      official_announcement_url: newUrl,
      last_edited_at: new Date().toISOString(),
      last_edited_by: editorId,
    })
    .eq('id', row.id)
  if (pickErr) return { ok: false, error: pickErr.message }

  if (edits.length > 0) {
    await admin.from('external_book_club_pick_edits').insert(edits)
  }

  // Resolve club slug for path-specific revalidation.
  const { data: clubRow } = await admin
    .from('external_book_clubs')
    .select('slug')
    .eq('id', row.club_id)
    .maybeSingle()
  const clubSlug = (clubRow as { slug: string } | null)?.slug
  const monthPad =
    row.pick_month != null ? String(row.pick_month).padStart(2, '0') : null

  revalidatePath('/admin/celebrity-picks')
  revalidatePath('/book-clubs')
  if (clubSlug) revalidatePath(`/book-clubs/${clubSlug}`)
  if (clubSlug && row.pick_year && monthPad) {
    revalidatePath(`/book-clubs/${clubSlug}/${row.pick_year}/${monthPad}`)
  }
  if (row.pick_year && monthPad) {
    revalidatePath(`/book-clubs/picks/${row.pick_year}/${monthPad}`)
  }

  return { ok: true }
}

/**
 * Add a pick manually for a club that did not get one through automation.
 * Creates a community book if the title is not already in the catalog.
 */
interface ManualPickResult {
  ok: boolean
  error?: string
}

export async function addManualCelebrityPick(
  formData: FormData,
): Promise<ManualPickResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  const title = String(formData.get('book_title') ?? '').trim()
  const author = String(formData.get('book_author') ?? '').trim()
  const month = Number(formData.get('pick_month') ?? 0)
  const year = Number(formData.get('pick_year') ?? 0)
  const quote = String(formData.get('curator_quote') ?? '').trim() || null
  const url =
    String(formData.get('official_announcement_url') ?? '').trim() || null

  if (!clubId || !title || !author || !month || !year) {
    return { ok: false, error: 'club, title, author, month, and year are required' }
  }

  const editorId = await getAuthedUserId()
  const admin = createAdminClient()

  // Try to find a matching book first; otherwise create a community book.
  const { data: existingBook } = await admin
    .from('books')
    .select('id')
    .ilike('title', title.replace(/'/g, "''"))
    .limit(1)
  let bookId = (existingBook as { id: string }[] | null)?.[0]?.id ?? null
  if (!bookId) {
    const titleSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60)
    const authorLast = (author.split(' ').pop() ?? 'unknown')
      .toLowerCase()
      .replace(/[^a-z]/g, '')
    const bookSlug = `${titleSlug}-${authorLast}`
    const { data: newBook, error: newBookError } = await admin
      .from('books')
      .insert({
        title,
        author,
        author_slug: author
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '-'),
        slug: bookSlug,
        source: 'community',
        source_type: 'community',
        description: quote ? quote.slice(0, 200) : null,
      })
      .select('id')
      .single()
    if (newBookError) return { ok: false, error: newBookError.message }
    bookId = (newBook as { id: string }).id
  }

  const pickedAt = `${year}-${String(month).padStart(2, '0')}-01`
  const { error: insertErr } = await admin
    .from('external_book_club_picks')
    .insert({
      club_id: clubId,
      book_id: bookId,
      pick_month: month,
      pick_year: year,
      picked_at: pickedAt,
      is_published: true,
      is_auto_discovered: false,
      auto_source: 'manual',
      auto_confidence: 'high',
      curator_quote: quote,
      official_announcement_url: url,
      last_edited_at: new Date().toISOString(),
      last_edited_by: editorId,
    })
  if (insertErr) return { ok: false, error: insertErr.message }

  const { data: clubRow } = await admin
    .from('external_book_clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const clubSlug = (clubRow as { slug: string } | null)?.slug
  const monthPad = String(month).padStart(2, '0')

  revalidatePath('/admin/celebrity-picks')
  revalidatePath('/book-clubs')
  if (clubSlug) revalidatePath(`/book-clubs/${clubSlug}`)
  if (clubSlug) revalidatePath(`/book-clubs/${clubSlug}/${year}/${monthPad}`)
  revalidatePath(`/book-clubs/picks/${year}/${monthPad}`)

  return { ok: true }
}
