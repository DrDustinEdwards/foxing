'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyIndexNow } from '@/lib/indexnow'
import { FOXING_BASE_URL } from '@/lib/metadata'
import { getAuthedUserId } from '@/lib/nav-user'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface JournalInput {
  id: string | null
  title: string
  slug: string
  excerpt: string
  cover_image_url: string
  tags: string
  content: string
  publish: boolean
}

function parseInput(formData: FormData): JournalInput {
  return {
    id: (formData.get('id') as string | null) || null,
    title: String(formData.get('title') ?? '').trim(),
    slug: String(formData.get('slug') ?? '').trim(),
    excerpt: String(formData.get('excerpt') ?? '').trim(),
    cover_image_url: String(formData.get('cover_image_url') ?? '').trim(),
    tags: String(formData.get('tags') ?? '').trim(),
    content: String(formData.get('content') ?? ''),
    publish: formData.get('publish') === 'true',
  }
}

export async function saveJournalPost(formData: FormData): Promise<{
  ok: boolean
  id?: string
  error?: string
}> {
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

  const authorId = await getAuthedUserId()
  const admin = createAdminClient()

  const payload = {
    title: input.title,
    slug,
    excerpt: input.excerpt || null,
    cover_image_url: input.cover_image_url || null,
    tags,
    content: input.content,
    is_published: input.publish,
    published_at: input.publish ? new Date().toISOString() : null,
    author_id: authorId,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { error } = await admin
      .from('journal_posts')
      .update(payload)
      .eq('id', input.id)
    if (error) return { ok: false, error: error.message }
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

export async function deleteJournalPost(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const admin = createAdminClient()
  await admin.from('journal_posts').delete().eq('id', id)
  revalidatePath('/admin/journal')
  redirect('/admin/journal')
}
