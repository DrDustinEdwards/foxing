import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { JournalEditor } from '../editor'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Edit journal post · Admin · Foxing',
}

interface JournalRow {
  id: string
  title: string
  slug: string
  excerpt: string | null
  cover_image_url: string | null
  tags: string[] | null
  content: string
  is_published: boolean
}

export default async function EditJournalPostPage({
  params,
}: {
  params: { id: string }
}) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('journal_posts')
    .select(
      'id, title, slug, excerpt, cover_image_url, tags, content, is_published',
    )
    .eq('id', params.id)
    .maybeSingle()
  const post = data as JournalRow | null
  if (!post) notFound()

  return (
    <div className="p-6 md:p-10">
      <p className="mb-4 font-dm-sans text-sm">
        <Link
          href="/admin/journal"
          className="text-brand-text hover:underline"
        >
          ← Journal
        </Link>
      </p>
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        {post.title}
      </h1>
      <p className="mt-1 font-dm-mono text-xs text-text-tertiary">
        {post.is_published ? 'Published' : 'Draft'} · /journal/{post.slug}
      </p>
      <div className="mt-6">
        <JournalEditor
          initial={{
            id: post.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt ?? '',
            cover_image_url: post.cover_image_url ?? '',
            tags: post.tags ?? [],
            content: post.content,
            is_published: post.is_published,
          }}
        />
      </div>
    </div>
  )
}
