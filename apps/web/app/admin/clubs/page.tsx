import Link from 'next/link'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatRelativeDate } from '@foxing/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin clubs · Foxing',
}

interface ClubRow {
  id: string
  name: string
  created_at: string
  member_count: number | null
  visibility: string
}

export default async function AdminClubsPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('clubs')
    .select('id, name, created_at, member_count, visibility')
    .order('created_at', { ascending: false })
    .limit(100)
  const clubs = (data as ClubRow[] | null) ?? []

  // Get post counts in one extra query
  const postCounts = new Map<string, number>()
  if (clubs.length > 0) {
    const { data: threads } = await admin
      .from('club_threads')
      .select('id, club_id, post_count')
      .in('club_id', clubs.map((c) => c.id))
    for (const row of (threads as Array<{
      club_id: string
      post_count: number | null
    }> | null) ?? []) {
      postCounts.set(
        row.club_id,
        (postCounts.get(row.club_id) ?? 0) + (row.post_count ?? 0),
      )
    }
  }

  return (
    <div className="p-6 md:p-10">
      <PageHeader title="Clubs" subtitle={`${clubs.length} clubs shown`} />

      <div className="mt-6 overflow-x-auto rounded-lg border border-border-subtle bg-bg-surface">
        <table className="min-w-full text-left font-dm-sans text-sm">
          <thead className="border-b border-border-subtle bg-bg-sunken text-xs uppercase tracking-wide text-text-tertiary">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Members</th>
              <th className="px-3 py-2">Posts</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Visibility</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {clubs.map((c) => (
              <tr key={c.id} className="hover:bg-bg-hover">
                <td className="px-3 py-2 font-medium text-text-primary">
                  {c.name}
                </td>
                <td className="px-3 py-2 text-text-secondary">
                  {c.member_count ?? 0}
                </td>
                <td className="px-3 py-2 text-text-secondary">
                  {postCounts.get(c.id) ?? 0}
                </td>
                <td className="px-3 py-2 font-dm-mono text-xs text-text-tertiary">
                  {formatRelativeDate(c.created_at)}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant={c.visibility === 'public' ? 'info' : 'neutral'}
                  >
                    {c.visibility}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/clubs/${c.id}/posts`}
                    className="font-dm-sans text-sm text-brand-text hover:underline"
                  >
                    View posts
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clubs.length === 0 && (
          <p className="px-4 py-6 font-source-serif-4 text-sm text-text-tertiary">
            No clubs yet.
          </p>
        )}
      </div>
    </div>
  )
}
