'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { runBotmSuggest } from './actions'

interface Candidate {
  id: string
  title: string
  author: string
  cover_url: string | null
  finished_count: number
  highlight_count: number
  total_score: number
  curator_note: string
}

export function BotmCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [touched, setTouched] = useState(false)

  function handleGenerate() {
    setError(null)
    setTouched(true)
    startTransition(() => {
      void (async () => {
        try {
          const result = await runBotmSuggest()
          setCandidates(result)
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not generate suggestions.',
          )
        }
      })()
    })
  }

  function buildNewLink(c: Candidate): string {
    const params = new URLSearchParams({
      book_id: c.id,
      title: c.title,
      author: c.author,
      curator_note: c.curator_note,
      ...(c.cover_url ? { cover_url: c.cover_url } : {}),
    })
    return `/admin/book-of-month/new?${params.toString()}`
  }

  return (
    <section className="rounded-lg border border-border-subtle bg-bg-surface p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-fraunces text-lg text-text-primary">
            Generate suggestion
          </h2>
          <p className="font-dm-sans text-sm text-text-tertiary">
            Top books by community activity in the last 30 days.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={handleGenerate}
          loading={pending}
        >
          {touched ? 'Regenerate' : 'Generate suggestion'}
        </Button>
      </header>

      {error && (
        <p className="mt-3 font-dm-sans text-sm text-error" role="alert">
          {error}
        </p>
      )}

      {candidates.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {candidates.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-md border border-border-subtle p-3"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded bg-bg-sunken">
                {c.cover_url && (
                  <Image
                    src={c.cover_url}
                    alt={c.title}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                )}
              </div>
              <p className="line-clamp-2 font-fraunces text-sm text-text-primary">
                {c.title}
              </p>
              <p className="truncate font-dm-sans text-xs text-text-tertiary">
                {c.author}
              </p>
              <p className="font-dm-mono text-xs text-text-tertiary">
                {c.finished_count} finished · {c.highlight_count} highlights
              </p>
              <Link href={buildNewLink(c)}>
                <Button type="button" variant="primary" size="sm" fullWidth>
                  Use this pick
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {touched && !pending && candidates.length === 0 && !error && (
        <p className="mt-3 font-source-serif-4 text-sm text-text-tertiary">
          No candidates yet. Need more community reading activity before
          suggestions can score.
        </p>
      )}
    </section>
  )
}
