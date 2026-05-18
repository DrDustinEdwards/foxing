import Link from 'next/link'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatRelativeDate } from '@foxing/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin users · Foxing',
}

interface UserRow {
  id: string
  display_name: string
  username: string
  avatar_url: string | null
  created_at: string
  subscription_tier: string | null
  is_admin: boolean
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const q = (searchParams.q ?? '').trim()
  const admin = createAdminClient()
  let query = admin
    .from('profiles')
    .select(
      'id, display_name, username, avatar_url, created_at, subscription_tier, is_admin',
    )
    .order('created_at', { ascending: false })
    .limit(50)
  if (q) {
    const like = `%${q.replace(/[%_]/g, '\\$&')}%`
    query = query.or(`display_name.ilike.${like},username.ilike.${like}`)
  }
  const { data } = await query
  const users = (data as UserRow[] | null) ?? []

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">Users</h1>

      <form className="mt-6 max-w-md" action="/admin/users" method="get">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by display name or username"
        />
      </form>

      <p className="mt-3 font-dm-sans text-sm text-text-tertiary">
        {users.length} {users.length === 1 ? 'user' : 'users'} shown
        {q && `, matching “${q}”`}
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border-subtle bg-bg-surface">
        <table className="min-w-full text-left font-dm-sans text-sm">
          <thead className="border-b border-border-subtle bg-bg-sunken text-xs uppercase tracking-wide text-text-tertiary">
            <tr>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Joined</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-bg-hover">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={u.avatar_url}
                      name={u.display_name}
                      size="sm"
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-text-primary">
                        {u.display_name}
                      </span>
                      <span className="truncate font-dm-mono text-xs text-text-tertiary">
                        @{u.username}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-dm-mono text-xs text-text-tertiary">
                  {formatRelativeDate(u.created_at)}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      u.subscription_tier === 'patron'
                        ? 'success'
                        : u.subscription_tier === 'plus'
                          ? 'brand'
                          : 'neutral'
                    }
                  >
                    {u.subscription_tier ?? 'free'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {u.is_admin ? (
                    <Badge variant="warning">Admin</Badge>
                  ) : (
                    <span className="text-text-tertiary">·</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="font-dm-sans text-sm text-brand-text hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="px-4 py-6 font-source-serif-4 text-sm text-text-tertiary">
            No users found.
          </p>
        )}
      </div>
    </div>
  )
}
