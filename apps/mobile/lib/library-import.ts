import { useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { supabase } from '@/lib/supabase'
import * as FileSystem from 'expo-file-system/legacy'

// ── EPUB sideloading ────────────────────────────────────────────────────
//
// Pick a file, upload to Supabase Storage under the user's personal
// folder, create books + user_books rows, navigate to reader.
//
// Storage bucket assumed: `epubs` (public read). Path:
//   personal/{userId}/{timestamp-filename}.epub
export async function sideloadEpub(router: ReturnType<typeof useRouter>): Promise<void> {
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

// URL → book matcher. Recognizes Gutenberg, Standard Ebooks, Goodreads, and
// Open Library links. For Gutenberg we have a direct ID column to match
// against; for the others we extract the title slug from the path and do an
// ilike search against the books table.
export async function findBookFromUrl(input: string): Promise<{ id: string } | null> {
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
