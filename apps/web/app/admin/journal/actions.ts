'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyIndexNow } from '@/lib/indexnow'
import { estimateReadingTime } from '@/lib/journal-shared'
import { FOXING_BASE_URL } from '@/lib/metadata'
import { requireAdminUserId } from '@/lib/nav-user'
import { slugify } from '@/lib/slug'

interface JournalInput {
  id: string | null
  title: string
  slug: string
  excerpt: string
  cover_image_url: string
  cover_image_alt: string
  tags: string
  content: string
  publish: boolean
  featured: boolean
  og_title: string
  og_description: string
  canonical_url: string
  published_at: string
  show_published_at: boolean
  show_updated_at: boolean
}

function parseInput(formData: FormData): JournalInput {
  return {
    id: (formData.get('id') as string | null) || null,
    title: String(formData.get('title') ?? '').trim(),
    slug: String(formData.get('slug') ?? '').trim(),
    excerpt: String(formData.get('excerpt') ?? '').trim(),
    cover_image_url: String(formData.get('cover_image_url') ?? '').trim(),
    cover_image_alt: String(formData.get('cover_image_alt') ?? '').trim(),
    tags: String(formData.get('tags') ?? '').trim(),
    content: String(formData.get('content') ?? ''),
    publish: formData.get('publish') === 'true',
    featured: formData.get('featured') === 'true',
    og_title: String(formData.get('og_title') ?? '').trim(),
    og_description: String(formData.get('og_description') ?? '').trim(),
    canonical_url: String(formData.get('canonical_url') ?? '').trim(),
    published_at: String(formData.get('published_at') ?? '').trim(),
    show_published_at: formData.get('show_published_at') === 'true',
    show_updated_at: formData.get('show_updated_at') === 'true',
  }
}

function parsePublishedAt(raw: string): string | null {
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export async function saveJournalPost(formData: FormData): Promise<{
  ok: boolean
  id?: string
  error?: string
}> {
  const authorId = await requireAdminUserId()
  const input = parseInput(formData)
  if (!input.title) return { ok: false, error: 'Title required.' }
  if (!input.content.trim()) return { ok: false, error: 'Content required.' }

  const slug = input.slug || slugify(input.title)
  if (!slug) return { ok: false, error: 'Could not derive a slug.' }

  const tags =
    input.tags.length > 0
      ? input.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : null

  const admin = createAdminClient()

  const customPublishedAt = parsePublishedAt(input.published_at)
  // When publishing, default the timestamp to now. When saving a draft,
  // keep any user-set publishedAt so the scheduled-publish cron can pick
  // it up later.
  const publishedAt = input.publish
    ? (customPublishedAt ?? new Date().toISOString())
    : customPublishedAt
  const reading_time_minutes = estimateReadingTime(input.content)
  const payload = {
    title: input.title,
    slug,
    excerpt: input.excerpt || null,
    cover_image_url: input.cover_image_url || null,
    cover_image_alt: input.cover_image_alt || null,
    tags,
    content: input.content,
    is_published: input.publish,
    published_at: publishedAt,
    author_id: authorId,
    updated_at: new Date().toISOString(),
    featured: input.featured,
    og_title: input.og_title || null,
    og_description: input.og_description || null,
    canonical_url: input.canonical_url || null,
    reading_time_minutes,
    show_published_at: input.show_published_at,
    show_updated_at: input.show_updated_at,
  }

  if (input.id) {
    const { error } = await admin
      .from('journal_posts')
      .update(payload)
      .eq('id', input.id)
    if (error) return { ok: false, error: error.message }
    void snapshotVersion(input.id, payload.title, payload.content, payload.excerpt)
    revalidatePath(`/admin/journal/${input.id}`)
    revalidatePath('/admin/journal')
    revalidatePath(`/journal/${slug}`)
    if (input.publish) {
      void notifyIndexNow([
        `${FOXING_BASE_URL}/journal/${slug}`,
        `${FOXING_BASE_URL}/journal`,
      ])
    }
    return { ok: true, id: input.id }
  }
  const { data, error } = await admin
    .from('journal_posts')
    .insert(payload)
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  const newId = (data as { id: string }).id
  void snapshotVersion(newId, payload.title, payload.content, payload.excerpt)
  revalidatePath('/admin/journal')
  revalidatePath(`/journal/${slug}`)
  if (input.publish) {
    void notifyIndexNow([
      `${FOXING_BASE_URL}/journal/${slug}`,
      `${FOXING_BASE_URL}/journal`,
    ])
  }
  return { ok: true, id: newId }
}

// Persist a snapshot for the version-history feature. Wrapped so any
// failure here cannot 500 an otherwise successful save.
async function snapshotVersion(
  postId: string,
  title: string,
  content: string,
  excerpt: string | null,
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('journal_post_versions').insert({
      post_id: postId,
      title,
      content,
      excerpt: excerpt ?? '',
    })
  } catch {
    // Non-fatal.
  }
}

export async function deleteJournalPost(formData: FormData) {
  await requireAdminUserId()
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const admin = createAdminClient()
  await admin.from('journal_posts').delete().eq('id', id)
  revalidatePath('/admin/journal')
  redirect('/admin/journal')
}

export async function duplicateJournalPost(formData: FormData) {
  const authorId = await requireAdminUserId()
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const admin = createAdminClient()
  const { data: src } = await admin
    .from('journal_posts')
    .select(
      'title, slug, excerpt, cover_image_url, tags, content, og_title, og_description, canonical_url',
    )
    .eq('id', id)
    .maybeSingle()
  const source = src as {
    title: string
    slug: string
    excerpt: string | null
    cover_image_url: string | null
    tags: string[] | null
    content: string
    og_title: string | null
    og_description: string | null
    canonical_url: string | null
  } | null
  if (!source) return

  const baseSlug = `${source.slug}-copy`
  let candidate = baseSlug
  for (let i = 2; i < 100; i += 1) {
    const { data: clash } = await admin
      .from('journal_posts')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!clash) break
    candidate = `${baseSlug}-${i}`
  }

  const { data, error } = await admin
    .from('journal_posts')
    .insert({
      title: `${source.title} (copy)`,
      slug: candidate,
      excerpt: source.excerpt,
      cover_image_url: source.cover_image_url,
      tags: source.tags,
      content: source.content,
      og_title: source.og_title,
      og_description: source.og_description,
      canonical_url: source.canonical_url,
      is_published: false,
      published_at: null,
      featured: false,
      author_id: authorId,
      updated_at: new Date().toISOString(),
      reading_time_minutes: estimateReadingTime(source.content),
    })
    .select('id')
    .single()
  if (error) return
  const newId = (data as { id: string }).id
  revalidatePath('/admin/journal')
  redirect(`/admin/journal/${newId}`)
}
