'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function dismissReport(formData: FormData) {
  const reportId = String(formData.get('reportId') ?? '')
  if (!reportId) return
  const admin = createAdminClient()
  await admin.from('post_reports').delete().eq('id', reportId)
  revalidatePath('/admin/content')
}

export async function deletePostFromReport(formData: FormData) {
  const reportId = String(formData.get('reportId') ?? '')
  const postId = String(formData.get('postId') ?? '')
  if (!reportId || !postId) return
  const admin = createAdminClient()
  await admin.from('club_posts').delete().eq('id', postId)
  await admin.from('post_reports').delete().eq('id', reportId)
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
  await admin.from('post_reports').delete().eq('id', reportId)
  revalidatePath('/admin/content')
}
