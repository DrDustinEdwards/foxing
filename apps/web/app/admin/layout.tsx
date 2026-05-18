import { redirect } from 'next/navigation'
import { type ReactNode } from 'react'
import { getAuthedUserId } from '@/lib/nav-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminSidebar } from './admin-sidebar'

/**
 * Admin layout. Middleware already verifies the user is signed in and
 * has is_admin=true, but we double-check here so a misconfigured
 * middleware matcher doesn't accidentally leak admin pages.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin, display_name')
    .eq('id', userId)
    .maybeSingle()
  const row = profile as { is_admin: boolean; display_name: string } | null
  if (!row?.is_admin) redirect('/home')

  return (
    <div className="flex min-h-screen bg-bg-base">
      <AdminSidebar adminName={row.display_name} />
      <main className="flex-1 md:ml-60">{children}</main>
    </div>
  )
}
