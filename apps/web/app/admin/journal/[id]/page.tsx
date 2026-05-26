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
  featured: boolean
  og_title: string | null
  og_description: string | null
  canonical_url: string | null
  published_at: string | null
  updated_at: string | null
}

export default async function EditJournalPostPage(
  props: {
    params: Promise<{ id: string }>
  }
) {
  const params = await props.params;
  const admin = createAdminClient()
  const { data } = await admin
    .from('journal_posts')
    .select(
      'id, title, slug, excerpt, cover_image_url, tags, content, is_published, featured, og_title, og_description, canonical_url, published_at, updated_at',
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
            featured: post.featured,
            og_title: post.og_title ?? '',
            og_description: post.og_description ?? '',
            canonical_url: post.canonical_url ?? '',
            published_at: post.published_at,
            updated_at: post.updated_at,
          }}
        />
      </div>
    </div>
  )
}
