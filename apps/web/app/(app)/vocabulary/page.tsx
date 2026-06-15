import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/select'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchVocabulary } from '@/lib/missing-pages-queries'
import { VOCABULARY_METADATA } from '@/lib/metadata'
import { getAuthedUserId } from '@/lib/nav-user'
import { MasteredToggle } from './mastered-toggle'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = VOCABULARY_METADATA

export default async function VocabularyPage(
  props: {
    searchParams: Promise<{ q?: string; book?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const entries = await fetchVocabulary(userId)

  const term = searchParams.q?.trim().toLowerCase()
  const bookFilter = searchParams.book?.trim().toLowerCase()
  const filtered = entries.filter((e) => {
    if (term && !e.word.toLowerCase().includes(term)) return false
    if (bookFilter) {
      const bt = (e.book?.title ?? e.book_title ?? '').toLowerCase()
      if (!bt.includes(bookFilter)) return false
    }
    return true
  })

  const bookOptions = Array.from(
    new Set(
      entries
        .map((e) => e.book?.title ?? e.book_title)
        .filter((t): t is string => Boolean(t)),
    ),
  ).sort()

  return (
    <PageWrapper className="py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-fraunces text-[1.75rem] text-text-primary">
          Your vocabulary
        </h1>
        <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
          Words you&apos;ve looked up while reading.
        </p>
      </header>

      <form
        action="/vocabulary"
        method="get"
        className="mt-6 flex flex-wrap items-center gap-3"
      >
        <input
          type="search"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Filter words"
          aria-label="Filter vocabulary"
          className="h-10 w-full max-w-xs rounded-md border border-border-interactive bg-bg-surface px-3 font-dm-sans text-base text-text-primary placeholder:text-text-tertiary focus:outline-none"
          autoComplete="off"
        />
        {bookOptions.length > 0 && (
          <Select
            name="book"
            defaultValue={searchParams.book ?? ''}
            aria-label="Filter by book"
            size="md"
            options={[
              { value: '', label: 'All books' },
              ...bookOptions.map((b) => ({ value: b, label: b })),
            ]}
          />
        )}
        <Button type="submit" variant="secondary" size="sm">
          Filter
        </Button>
        {entries.length > 0 && (
          <div className="ml-auto flex gap-2">
            <Link href="/api/vocabulary/export?format=csv" prefetch={false}>
              <Button variant="secondary" size="sm">
                CSV
              </Button>
            </Link>
            <Link href="/api/vocabulary/export?format=anki" prefetch={false}>
              <Button variant="secondary" size="sm">
                Anki deck
              </Button>
            </Link>
          </div>
        )}
      </form>

      {entries.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            heading="No words yet."
            action={
              <p className="font-source-serif-4 text-sm text-text-tertiary">
                Tap a word in the reader to add it here.
              </p>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
          No matches.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {filtered.map((e) => (
            <li
              key={e.id}
              className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-bg-surface p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-fraunces text-base text-text-primary">
                  {e.word}
                </h2>
                {e.looked_up_at && (
                  <time className="font-dm-mono text-[0.6875rem] text-text-tertiary">
                    {new Date(e.looked_up_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </time>
                )}
              </div>
              {(e.definition || e.ai_context) && (
                <p className="font-source-serif-4 text-sm text-text-secondary">
                  {e.definition ?? e.ai_context}
                </p>
              )}
              {e.context_sentence && (
                <p className="font-source-serif-4 text-sm italic text-text-tertiary">
                  &ldquo;{e.context_sentence}&rdquo;
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {e.book ? (
                  <Link
                    href={`/book/${e.book.slug ?? e.book.id}`}
                    className="font-dm-sans text-xs text-text-tertiary hover:text-text-primary"
                  >
                    {e.book.title}
                  </Link>
                ) : e.book_title ? (
                  <span className="font-dm-sans text-xs text-text-tertiary">
                    {e.book_title}
                  </span>
                ) : (
                  <span />
                )}
                <MasteredToggle id={e.id} initiallyMastered={Boolean(e.mastered)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageWrapper>
  )
}
