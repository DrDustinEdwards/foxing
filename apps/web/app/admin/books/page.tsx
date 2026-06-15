import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin books · Foxing',
}

interface BookRow {
  id: string
  title: string
  author: string
  cover_url: string | null
  source: string | null
  word_count: number | null
}

export default async function AdminBooksPage(
  props: {
    searchParams: Promise<{ q?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const q = (searchParams.q ?? '').trim()
  const admin = createAdminClient()
  let query = admin
    .from('books')
    .select('id, title, author, cover_url, source, word_count')
    .order('title', { ascending: true })
    .limit(50)
  if (q) {
    const like = `%${q.replace(/[%_]/g, '\\$&')}%`
    query = query.or(`title.ilike.${like},author.ilike.${like}`)
  }
  const { data, count } = await admin
    .from('books')
    .select('id', { count: 'exact', head: true })
  const totalCount = count ?? 0
  const { data: books } = await query
  const rows = (books as BookRow[] | null) ?? []

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Books"
        subtitle={`${totalCount.toLocaleString()} books in catalog`}
      />

      <form className="mt-6 max-w-md" action="/admin/books" method="get">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by title or author"
        />
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border-subtle bg-bg-surface">
        <table className="min-w-full text-left font-dm-sans text-sm">
          <thead className="border-b border-border-subtle bg-bg-sunken text-xs uppercase tracking-wide text-text-tertiary">
            <tr>
              <th className="px-3 py-2">Cover</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Author</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Words</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((b) => (
              <tr key={b.id} className="hover:bg-bg-hover">
                <td className="px-3 py-2">
                  <div className="relative h-12 w-9 overflow-hidden rounded bg-bg-sunken">
                    {b.cover_url && (
                      <Image
                        src={b.cover_url}
                        alt={b.title}
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 font-medium text-text-primary">
                  {b.title}
                </td>
                <td className="px-3 py-2 text-text-secondary">{b.author}</td>
                <td className="px-3 py-2 text-text-tertiary">
                  {b.source ?? 'unknown'}
                </td>
                <td className="px-3 py-2 font-dm-mono text-xs text-text-tertiary">
                  {b.word_count?.toLocaleString() ?? ''}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/books/${b.id}/edit`}
                    className="font-dm-sans text-sm text-brand-text hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-6 font-source-serif-4 text-sm text-text-tertiary">
            No books match.
          </p>
        )}
      </div>
    </div>
  )
}
