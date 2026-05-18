import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { createClient } from '@/lib/supabase/server'
import { siteOrigin } from '@/lib/foxing'

export const dynamic = 'force-dynamic'

interface ListRow {
  id: string
  title: string
  description: string | null
  is_public: boolean
  user_id: string
  created_at: string
}

async function fetchList(id: string): Promise<ListRow | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null
  }
  const sb = createClient()
  const { data, error } = await sb
    .from('reading_lists')
    .select('id, title, description, is_public, user_id, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) return null
  return (data as ListRow | null) ?? null
}

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const list = await fetchList(params.id)
  if (!list) return { title: 'List not found · Foxing' }
  return {
    title: `${list.title} · Foxing`,
    description: list.description ?? undefined,
    alternates: { canonical: `${siteOrigin()}/my-lists/${list.id}` },
  }
}

export default async function ListDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const list = await fetchList(params.id)
  if (!list) notFound()
  return (
    <PageWrapper className="max-w-prose py-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        {list.title}
      </h1>
      {list.description && (
        <p className="mt-3 font-source-serif-4 text-base text-text-secondary">
          {list.description}
        </p>
      )}
      <p className="mt-6 font-source-serif-4 text-base text-text-tertiary">
        Reorder, share, and add books from the Foxing app.
      </p>
      <Link
        href="/my-lists"
        className="mt-6 inline-block font-dm-sans text-sm text-brand-text hover:underline"
      >
        Back to lists
      </Link>
    </PageWrapper>
  )
}
