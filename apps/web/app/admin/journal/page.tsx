import Link from 'next/link'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatRelativeDate } from '@foxing/utils'
import { DuplicateButton } from './DuplicateButton'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Journal · Admin · Foxing',
}

interface JournalRow {
  id: string
  title: string
  slug: string
  is_published: boolean
  published_at: string | null
  created_at: string
}

export default async function AdminJournalListPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('journal_posts')
    .select('id, title, slug, is_published, published_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  const posts = (data as JournalRow[] | null) ?? []

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Journal"
        actions={
          <Link href="/admin/journal/new">
            <Button variant="primary" size="sm">
              New post
            </Button>
          </Link>
        }
      />

      {posts.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            heading="No journal posts yet."
            action={
              <Link href="/admin/journal/new">
                <Button variant="primary" size="sm">
                  Write the first post
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border-subtle bg-bg-surface">
          <table className="min-w-full text-left font-dm-sans text-sm">
            <thead className="border-b border-border-subtle bg-bg-sunken text-xs uppercase tracking-wide text-text-tertiary">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {posts.map((p) => (
                <tr key={p.id} className="hover:bg-bg-hover">
                  <td className="px-3 py-2 font-medium text-text-primary">
                    {p.title}
                  </td>
                  <td className="px-3 py-2 font-dm-mono text-xs text-text-tertiary">
                    {p.slug}
                  </td>
                  <td className="px-3 py-2">
                    {p.is_published ? (
                      <Badge variant="success">Published</Badge>
                    ) : (
                      <Badge variant="neutral">Draft</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 font-dm-mono text-xs text-text-tertiary">
                    {formatRelativeDate(p.published_at ?? p.created_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex items-center gap-3">
                      <Link
                        href={`/admin/journal/preview/${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-dm-sans text-sm text-text-tertiary hover:text-text-primary"
                      >
                        Preview
                      </Link>
                      <DuplicateButton id={p.id} title={p.title} />
                      <Link
                        href={`/admin/journal/${p.id}`}
                        className="font-dm-sans text-sm text-brand-text hover:underline"
                      >
                        Edit
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
