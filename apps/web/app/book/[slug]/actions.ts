'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/nav-user'
import { checkAndAwardBadges } from '@/lib/badges'
import { reportWriteError } from '@/lib/db-write'
import {
  generateAndStoreDiscussionGuide,
  type DiscussionQuestion,
} from '@/lib/discussion-guide'

const VALID_TYPES = new Set([
  'general',
  'chapter',
  'prediction',
  'first_impressions',
  'deep_dive',
  'hot_take',
  'quote',
  'character',
  'theme',
  'questions',
  'wrap_up',
])

const VALID_REACTIONS = new Set(['👍', '❤️', '😂', '😢', '🤔', '🔥'])
const VALID_CHAPTER_EMOJIS = new Set([
  '😭',
  '😂',
  '😱',
  '😤',
  '🥺',
  '🤯',
  '❤️',
  '🙃',
])
const VALID_PRIVACY = new Set(['public', 'close_friends', 'private'])

type ActionResult = { ok: true } | { ok: false; error: string }

interface Result {
  ok: boolean
  questions?: DiscussionQuestion[]
  error?: string
}

export async function generateDiscussionGuide(
  formData: FormData,
): Promise<Result> {
  const bookId = String(formData.get('book_id') ?? '').trim()
  const bookSlug = String(formData.get('book_slug') ?? '').trim()
  if (!bookId) return { ok: false, error: 'Missing book id.' }
  try {
    const guide = await generateAndStoreDiscussionGuide(bookId)
    if (!guide) return { ok: false, error: 'Could not generate guide.' }
    if (bookSlug) revalidatePath(`/book/${bookSlug}`)
    return { ok: true, questions: guide.questions }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Generation failed.',
    }
  }
}

// ─── Discussions ──────────────────────────────────────────────────────────

export async function createDiscussion(formData: FormData): Promise<void> {
  const bookId = String(formData.get('book_id') ?? '').trim()
  const bookSlug = String(formData.get('book_slug') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim().slice(0, 120)
  const typeRaw = String(formData.get('type') ?? '').trim()
  const type = VALID_TYPES.has(typeRaw) ? typeRaw : 'general'
  const spoilerTagged = formData.get('spoiler_tagged') === 'on'
  const chapterGate = String(formData.get('chapter_gate') ?? '').trim() || null
  const firstPost = String(formData.get('first_post') ?? '').trim().slice(0, 5000)

  if (!bookId || !title || !firstPost) {
    throw new Error('Title and first post are required.')
  }
  const userId = await getAuthedUserId()
  if (!userId) throw new Error('Sign in to start a discussion.')

  const sb = await createClient()
  const { data: discussion, error: discErr } = await sb
    .from('discussions')
    .insert({
      book_id: bookId,
      author_id: userId,
      title,
      type,
      spoiler_tagged: spoilerTagged,
      chapter_gate: chapterGate,
    })
    .select('id')
    .single()
  if (discErr || !discussion) {
    throw new Error(discErr?.message ?? 'Could not start discussion.')
  }
  const discussionId = (discussion as { id: string }).id

  const { error: postErr } = await sb.from('discussion_posts').insert({
    discussion_id: discussionId,
    author_id: userId,
    content: firstPost,
    has_spoiler: spoilerTagged,
    parent_id: null,
  })
  if (postErr) {
    throw new Error(postErr.message)
  }
  if (bookSlug) revalidatePath(`/book/${bookSlug}`)
  redirect(`/book/${bookSlug}/discussions/${discussionId}`)
}

export async function createDiscussionPost(
  formData: FormData,
): Promise<ActionResult> {
  const discussionId = String(formData.get('discussion_id') ?? '').trim()
  const bookSlug = String(formData.get('book_slug') ?? '').trim()
  const content = String(formData.get('content') ?? '').trim().slice(0, 5000)
  const hasSpoiler = formData.get('has_spoiler') === 'on'
  const parentId = String(formData.get('parent_id') ?? '').trim() || null
  if (!discussionId || !content) {
    return { ok: false, error: 'Write a reply.' }
  }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in to reply.' }

  const sb = await createClient()
  const { error } = await sb.from('discussion_posts').insert({
    discussion_id: discussionId,
    author_id: userId,
    content,
    has_spoiler: hasSpoiler,
    parent_id: parentId,
  })
  if (error) return { ok: false, error: error.message }

  await sb
    .from('discussions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', discussionId)

  await checkAndAwardBadges(userId)
  if (bookSlug) {
    revalidatePath(`/book/${bookSlug}`)
    revalidatePath(`/book/${bookSlug}/discussions/${discussionId}`)
  }
  return { ok: true }
}

export async function updateDiscussionPost(
  formData: FormData,
): Promise<ActionResult> {
  const postId = String(formData.get('post_id') ?? '').trim()
  const content = String(formData.get('content') ?? '').trim().slice(0, 5000)
  const bookSlug = String(formData.get('book_slug') ?? '').trim()
  const discussionId = String(formData.get('discussion_id') ?? '').trim()
  if (!postId || !content) return { ok: false, error: 'Content required.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { data: post } = await sb
    .from('discussion_posts')
    .select('author_id')
    .eq('id', postId)
    .maybeSingle()
  const row = post as { author_id: string } | null
  if (!row) return { ok: false, error: 'Post not found.' }
  if (row.author_id !== userId) {
    return { ok: false, error: 'You can only edit your own posts.' }
  }
  const { error } = await sb
    .from('discussion_posts')
    .update({ content, is_edited: true, updated_at: new Date().toISOString() })
    .eq('id', postId)
  if (error) return { ok: false, error: error.message }
  if (bookSlug && discussionId) {
    revalidatePath(`/book/${bookSlug}/discussions/${discussionId}`)
  }
  return { ok: true }
}

export async function deleteDiscussionPost(
  formData: FormData,
): Promise<ActionResult> {
  const postId = String(formData.get('post_id') ?? '').trim()
  const bookSlug = String(formData.get('book_slug') ?? '').trim()
  const discussionId = String(formData.get('discussion_id') ?? '').trim()
  if (!postId) return { ok: false, error: 'Missing id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { data: post } = await sb
    .from('discussion_posts')
    .select('author_id')
    .eq('id', postId)
    .maybeSingle()
  const row = post as { author_id: string } | null
  if (!row) return { ok: false, error: 'Post not found.' }
  if (row.author_id !== userId) {
    return { ok: false, error: 'You can only delete your own posts.' }
  }
  const { error } = await sb
    .from('discussion_posts')
    .delete()
    .eq('id', postId)
  if (error) return { ok: false, error: error.message }
  if (bookSlug && discussionId) {
    revalidatePath(`/book/${bookSlug}/discussions/${discussionId}`)
  }
  return { ok: true }
}

export async function togglePostReaction(
  formData: FormData,
): Promise<ActionResult> {
  const postId = String(formData.get('post_id') ?? '').trim()
  const reaction = String(formData.get('reaction') ?? '').trim()
  const bookSlug = String(formData.get('book_slug') ?? '').trim()
  const discussionId = String(formData.get('discussion_id') ?? '').trim()
  if (!postId || !VALID_REACTIONS.has(reaction)) {
    return { ok: false, error: 'Invalid reaction.' }
  }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in to react.' }
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('post_reactions')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .eq('reaction', reaction)
    .maybeSingle()
  if (existing) {
    const { error } = await admin
      .from('post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('reaction', reaction)
    if (reportWriteError(error, { op: 'togglePostReaction.remove', table: 'post_reactions' })) {
      return { ok: false, error: 'Could not update reaction.' }
    }
  } else {
    const { error } = await admin.from('post_reactions').insert({
      post_id: postId,
      user_id: userId,
      reaction,
    })
    if (reportWriteError(error, { op: 'togglePostReaction.add', table: 'post_reactions' })) {
      return { ok: false, error: 'Could not update reaction.' }
    }
  }
  if (bookSlug && discussionId) {
    revalidatePath(`/book/${bookSlug}/discussions/${discussionId}`)
  }
  return { ok: true }
}

// ─── User book tags ───────────────────────────────────────────────────────

function normalizeTag(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  if (cleaned.length === 0 || cleaned.length > 30) return null
  return cleaned
}

export async function addBookTag(
  formData: FormData,
): Promise<ActionResult> {
  const bookId = String(formData.get('book_id') ?? '').trim()
  const bookSlug = String(formData.get('book_slug') ?? '').trim()
  const tag = normalizeTag(String(formData.get('tag') ?? ''))
  if (!bookId || !tag) return { ok: false, error: 'Pick a tag.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { count } = await sb
    .from('user_book_tags')
    .select('tag', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('book_id', bookId)
  if ((count ?? 0) >= 20) {
    return { ok: false, error: 'Up to 20 tags per book.' }
  }
  const { error } = await sb.from('user_book_tags').upsert(
    { user_id: userId, book_id: bookId, tag },
    { onConflict: 'user_id,book_id,tag', ignoreDuplicates: true },
  )
  if (error) return { ok: false, error: error.message }
  if (bookSlug) revalidatePath(`/book/${bookSlug}`)
  revalidatePath('/library')
  return { ok: true }
}

export async function removeBookTag(
  formData: FormData,
): Promise<ActionResult> {
  const bookId = String(formData.get('book_id') ?? '').trim()
  const bookSlug = String(formData.get('book_slug') ?? '').trim()
  const tag = normalizeTag(String(formData.get('tag') ?? ''))
  if (!bookId || !tag) return { ok: false, error: 'Missing fields.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { error } = await sb
    .from('user_book_tags')
    .delete()
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .eq('tag', tag)
  if (error) return { ok: false, error: error.message }
  if (bookSlug) revalidatePath(`/book/${bookSlug}`)
  revalidatePath('/library')
  return { ok: true }
}

// ─── Bookmarks ────────────────────────────────────────────────────────────

export async function deleteBookmark(
  formData: FormData,
): Promise<ActionResult> {
  const bookmarkId = String(formData.get('bookmark_id') ?? '').trim()
  const bookSlug = String(formData.get('book_slug') ?? '').trim()
  if (!bookmarkId) return { ok: false, error: 'Missing id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { error } = await sb
    .from('bookmarks')
    .delete()
    .eq('id', bookmarkId)
    .eq('user_id', userId)
  if (error) return { ok: false, error: error.message }
  if (bookSlug) revalidatePath(`/book/${bookSlug}`)
  return { ok: true }
}

// ─── Chapter reactions ────────────────────────────────────────────────────

export async function addChapterReaction(
  formData: FormData,
): Promise<ActionResult> {
  const bookId = String(formData.get('book_id') ?? '').trim()
  const bookSlug = String(formData.get('book_slug') ?? '').trim()
  const chapterName = String(formData.get('chapter_name') ?? '').trim().slice(0, 80)
  const emoji = String(formData.get('emoji') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || null
  const privacyRaw = String(formData.get('privacy') ?? '').trim()
  if (!bookId || !chapterName || !VALID_CHAPTER_EMOJIS.has(emoji)) {
    return { ok: false, error: 'Chapter and emoji required.' }
  }
  const privacy = VALID_PRIVACY.has(privacyRaw) ? privacyRaw : 'public'
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { error } = await sb.from('chapter_reactions').insert({
    user_id: userId,
    book_id: bookId,
    chapter_name: chapterName,
    emoji,
    note,
    privacy,
  })
  if (error) return { ok: false, error: error.message }
  if (bookSlug) revalidatePath(`/book/${bookSlug}`)
  return { ok: true }
}

export async function deleteChapterReaction(
  formData: FormData,
): Promise<ActionResult> {
  const reactionId = String(formData.get('reaction_id') ?? '').trim()
  const bookSlug = String(formData.get('book_slug') ?? '').trim()
  if (!reactionId) return { ok: false, error: 'Missing id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { error } = await sb
    .from('chapter_reactions')
    .delete()
    .eq('id', reactionId)
    .eq('user_id', userId)
  if (error) return { ok: false, error: error.message }
  if (bookSlug) revalidatePath(`/book/${bookSlug}`)
  return { ok: true }
}
