'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function deleteClubPost(formData: FormData) {
  const postId = String(formData.get('postId') ?? '')
  const clubId = String(formData.get('clubId') ?? '')
  if (!postId) return
  const admin = createAdminClient()
  await admin.from('club_posts').delete().eq('id', postId)
  if (clubId) revalidatePath(`/admin/clubs/${clubId}/posts`)
}
