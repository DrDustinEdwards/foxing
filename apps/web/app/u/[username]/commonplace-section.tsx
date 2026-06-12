import Link from 'next/link'
import { formatRelativeDate } from '@foxing/utils'
import type { CommonplaceEntry } from '@/lib/commonplace'

interface Props {
  username: string
  entries: CommonplaceEntry[]
}

export function CommonplaceProfileSection({ username, entries }: Props) {
  if (entries.length === 0) return null
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between">
        <h2 className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
          Commonplace Book
        </h2>
        <Link
          href={`/u/${username}/commonplace`}
          className="font-dm-sans text-xs text-brand-text hover:underline"
        >
          See all →
        </Link>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {entries.map((e) => {
          const bookPath = e.book?.slug ?? e.book?.id
          return (
            <li
              key={e.id}
              className="rounded-md border border-border-subtle bg-bg-surface p-4"
            >
              <blockquote className="border-l-2 border-brand-ui pl-4 font-source-serif-4 text-base italic text-text-primary">
                {e.passage_text}
              </blockquote>
              <div className="mt-2 flex flex-wrap gap-2 font-dm-mono text-xs text-text-tertiary">
                {e.book?.title && bookPath ? (
                  <Link
                    href={`/book/${bookPath}`}
                    className="hover:text-text-primary"
                  >
                    {e.book.title}
                    {e.book.author && ` by ${e.book.author}`}
                  </Link>
                ) : e.book_title ? (
                  <span>{e.book_title}</span>
                ) : null}
                <span>· {formatRelativeDate(e.created_at)}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
