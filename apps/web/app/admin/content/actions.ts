'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminId(): Promise<string | null> {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  return user?.id ?? null
}

const POST_TABLES: Record<string, string> = {
  club_post: 'club_posts',
  passage_comment: 'passage_comments',
  diary_entry: 'diary_entries',
  highlight: 'highlights',
  review: 'user_books',
}

export async function dismissReport(formData: FormData) {
  const reportId = String(formData.get('reportId') ?? '')
  if (!reportId) return
  const admin = createAdminClient()
  await admin
    .from('post_reports')
    .update({
      status: 'dismissed',
      reviewed_at: new Date().toISOString(),
      reviewed_by: await getAdminId(),
    })
    .eq('id', reportId)
  revalidatePath('/admin/content')
}

export async function deletePostFromReport(formData: FormData) {
  const reportId = String(formData.get('reportId') ?? '')
  const postId = String(formData.get('postId') ?? '')
  const postType = String(formData.get('postType') ?? 'club_post')
  if (!reportId || !postId) return
  const table = POST_TABLES[postType] ?? 'club_posts'
  const admin = createAdminClient()
  await admin.from(table).delete().eq('id', postId)
  await admin
    .from('post_reports')
    .update({
      status: 'actioned',
      reviewed_at: new Date().toISOString(),
      reviewed_by: await getAdminId(),
    })
    .eq('id', reportId)
  revalidatePath('/admin/content')
}

export async function warnUser(formData: FormData) {
  const reportId = String(formData.get('reportId') ?? '')
  const authorId = String(formData.get('authorId') ?? '')
  const reason = String(formData.get('reason') ?? '')
  if (!reportId || !authorId) return
  const admin = createAdminClient()
  await admin.from('notifications').insert({
    user_id: authorId,
    type: 'moderation_warning',
    title: 'A moderator reviewed one of your posts',
    body: reason
      ? `Reason given: ${reason}`
      : 'A post you wrote was flagged. Please review the community rules.',
  })
  await admin
    .from('post_reports')
    .update({
      status: 'actioned',
      reviewed_at: new Date().toISOString(),
      reviewed_by: await getAdminId(),
    })
    .eq('id', reportId)
  revalidatePath('/admin/content')
}
