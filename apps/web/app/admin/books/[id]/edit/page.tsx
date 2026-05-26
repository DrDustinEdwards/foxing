import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { BookEditForm } from './book-edit-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Edit book, Foxing admin',
}

interface BookRow {
  id: string
  title: string
  author: string
  description: string | null
  cover_url: string | null
  themes: string[] | null
  mood_tags: string[] | null
  content_warnings: string[] | null
  pacing: string | null
  is_staff_pick: boolean | null
  staff_pick_note: string | null
  isbn: string | null
  isbn13: string | null
  publication_year: number | null
  reading_difficulty: number | null
  word_count: number | null
  source: string | null
}

export default async function AdminBookEditPage(
  props: {
    params: Promise<{ id: string }>
  }
) {
  const params = await props.params;
  const admin = createAdminClient()
  const { data } = await admin
    .from('books')
    .select(
      'id, title, author, description, cover_url, themes, mood_tags, content_warnings, pacing, is_staff_pick, staff_pick_note, isbn, isbn13, publication_year, reading_difficulty, word_count, source',
    )
    .eq('id', params.id)
    .maybeSingle()
  const book = data as BookRow | null
  if (!book) notFound()

  const { count } = await admin
    .from('book_ai_cache')
    .select('book_id', { count: 'exact', head: true })
    .eq('book_id', book.id)

  return (
    <div className="p-6 md:p-10">
      <p className="mb-4 font-dm-sans text-sm">
        <Link href="/admin/books" className="text-brand-text hover:underline">
          ← All books
        </Link>
      </p>

      <header className="flex items-start gap-4">
        <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded bg-bg-sunken">
          {book.cover_url && (
            <Image
              src={book.cover_url}
              alt={book.title}
              fill
              sizes="96px"
              className="object-cover"
            />
          )}
        </div>
        <div>
          <h1 className="font-fraunces text-2xl text-text-primary">
            {book.title}
          </h1>
          <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
            {book.author}
          </p>
          <p className="mt-2 font-dm-mono text-xs text-text-tertiary">
            Source: {book.source ?? 'unknown'} · {count ?? 0} AI cache entries
          </p>
        </div>
      </header>

      <div className="mt-8 rounded-lg border border-border-subtle bg-bg-surface p-5">
        <BookEditForm book={book} cacheCount={count ?? 0} />
      </div>
    </div>
  )
}
