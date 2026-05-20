'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatRelativeDate } from '@foxing/utils'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

interface PublicReaction {
  id: string
  chapter_name: string
  emoji: string
  note: string | null
  created_at: string
  author: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

interface ChapterGroup {
  chapter: string
  earliestISO: string
  reactions: PublicReaction[]
  emojis: Array<{ emoji: string; count: number }>
}

interface Props {
  reactions: PublicReaction[]
  inLibrary: boolean
  progressPercentage: number | null
}

function safeCutoff(
  groupCount: number,
  inLibrary: boolean,
  progress: number | null,
): number {
  if (!inLibrary) return groupCount
  if (progress === null) return 0
  if (progress >= 90) return groupCount
  if (progress >= 50) return Math.floor(groupCount / 2)
  return 0
}

export function CommunityReactionsSection({
  reactions,
  inLibrary,
  progressPercentage,
}: Props) {
  const groups = useMemo<ChapterGroup[]>(() => {
    const byChapter = new Map<string, PublicReaction[]>()
    for (const r of reactions) {
      const arr = byChapter.get(r.chapter_name) ?? []
      arr.push(r)
      byChapter.set(r.chapter_name, arr)
    }
    return [...byChapter.entries()]
      .map(([chapter, items]) => {
        items.sort((a, b) => a.created_at.localeCompare(b.created_at))
        const counts = new Map<string, number>()
        for (const r of items)
          counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1)
        const emojis = [...counts.entries()]
          .map(([emoji, count]) => ({ emoji, count }))
          .sort((a, b) => b.count - a.count)
        return {
          chapter,
          earliestISO: items[0]?.created_at ?? '',
          reactions: items,
          emojis,
        }
      })
      .sort((a, b) => a.earliestISO.localeCompare(b.earliestISO))
  }, [reactions])

  const cutoff = safeCutoff(groups.length, inLibrary, progressPercentage)

  if (groups.length === 0) return null

  return (
    <section className="mt-10 border-t border-border-subtle pt-6">
      <h2 className="font-fraunces text-xl text-text-primary">
        Community reactions
      </h2>
      <p className="mt-1 max-w-prose font-source-serif-4 text-sm text-text-secondary">
        Reactions from readers who&apos;ve finished each chapter. Reactions
        ahead of your position are blurred.
      </p>
      <ul className="mt-6 flex flex-col gap-4">
        {groups.map((g, i) => (
          <ChapterRow
            key={g.chapter}
            group={g}
            isSafe={i < cutoff}
          />
        ))}
      </ul>
    </section>
  )
}

function ChapterRow({
  group,
  isSafe,
}: {
  group: ChapterGroup
  isSafe: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const showFull = isSafe || revealed

  return (
    <li className="rounded-lg border border-border-subtle bg-bg-surface p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-fraunces text-base text-text-primary">
          {group.chapter}
        </h3>
        <span className="font-dm-mono text-xs text-text-tertiary">
          {group.reactions.length}{' '}
          {group.reactions.length === 1 ? 'reaction' : 'reactions'}
        </span>
      </header>

      <ul
        className={cn(
          'mt-3 flex flex-wrap gap-2 transition-all',
          !showFull && 'select-none blur-sm',
        )}
        aria-hidden={!showFull}
      >
        {group.emojis.map((e) => (
          <li
            key={e.emoji}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-sunken px-3 py-1 font-dm-sans text-sm text-text-secondary"
          >
            <span aria-hidden="true">{e.emoji}</span>
            <span>× {e.count}</span>
          </li>
        ))}
      </ul>

      {!showFull && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-dm-sans text-xs text-text-tertiary">
            ⚠ Contains spoilers
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRevealed(true)}
          >
            Reveal anyway
          </Button>
        </div>
      )}

      {showFull && group.reactions.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-dm-sans text-sm text-brand-text hover:underline"
            aria-expanded={expanded}
          >
            {expanded ? 'Hide details' : 'Show individual reactions'}
          </button>
          {expanded && (
            <ul className="mt-3 flex flex-col gap-2">
              {group.reactions.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start gap-3 rounded-md border border-border-subtle bg-bg-sunken p-3"
                >
                  <span aria-hidden="true" className="text-2xl">
                    {r.emoji}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2 font-dm-mono text-xs text-text-tertiary">
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
          )}
        </div>
      )}
    </li>
  )
}
