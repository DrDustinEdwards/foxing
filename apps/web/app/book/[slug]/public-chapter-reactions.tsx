import Link from 'next/link'
import { formatRelativeDate } from '@foxing/utils'
import { Avatar } from '@/components/ui/avatar'
import type { PublicChapterReaction } from '@/lib/chapter-reactions'

interface Props {
  reactions: PublicChapterReaction[]
}

export function PublicChapterReactions({ reactions }: Props) {
  if (reactions.length === 0) return null

  const byEmoji = new Map<string, number>()
  for (const r of reactions) {
    byEmoji.set(r.emoji, (byEmoji.get(r.emoji) ?? 0) + 1)
  }
  const summary = [...byEmoji.entries()].sort((a, b) => b[1] - a[1])

  return (
    <section className="mt-10 border-t border-border-subtle pt-6">
      <h2 className="font-fraunces text-xl text-text-primary">
        Community reactions
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {summary.map(([emoji, count]) => (
          <li
            key={emoji}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-sunken px-3 py-1 font-dm-sans text-sm text-text-secondary"
          >
            <span aria-hidden="true">{emoji}</span>
            <span>
              {count} {count === 1 ? 'person' : 'people'}
            </span>
          </li>
        ))}
      </ul>
      <ul className="mt-6 flex flex-col gap-2">
        {reactions.slice(0, 10).map((r) => (
          <li
            key={r.id}
            className="flex items-start gap-3 rounded-md border border-border-subtle bg-bg-surface p-3"
          >
            <span aria-hidden="true" className="text-2xl">
              {r.emoji}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-2 font-dm-mono text-xs text-text-tertiary">
                {r.author && (
                  <Link
                    href={`/u/${r.author.username}`}
                    className="flex items-center gap-2 text-text-primary hover:underline"
                  >
                    <Avatar
                      src={r.author.avatar_url}
                      name={r.author.display_name}
                      size="sm"
                    />
                    {r.author.display_name}
                  </Link>
                )}
                <span>· {r.chapter_name}</span>
                <span>· {formatRelativeDate(r.created_at)}</span>
              </div>
              {r.note && (
                <p className="whitespace-pre-line font-source-serif-4 text-sm text-text-secondary">
                  {r.note}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
