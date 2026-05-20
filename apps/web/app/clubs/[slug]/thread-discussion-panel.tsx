'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DiscussionQuestion } from '@/lib/discussion-guide-types'
import { generateDiscussionGuide } from '@/app/book/[slug]/actions'

interface Props {
  bookId: string
  bookSlug: string | null
  bookTitle: string
  initialQuestions: DiscussionQuestion[] | null
  canGenerate: boolean
}

export function ThreadDiscussionPanel({
  bookId,
  bookSlug,
  bookTitle,
  initialQuestions,
  canGenerate,
}: Props) {
  const [questions, setQuestions] = useState<DiscussionQuestion[] | null>(
    initialQuestions,
  )
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('book_id', bookId)
    if (bookSlug) fd.set('book_slug', bookSlug)
    const res = await generateDiscussionGuide(fd)
    setPending(false)
    if (!res.ok || !res.questions) {
      setError(res.error ?? 'Generation failed.')
      return
    }
    setQuestions(res.questions)
    setOpen(true)
  }

  async function handleCopy() {
    if (!questions) return
    const text = questions
      .map((q, i) => `${i + 1}. ${q.question}`)
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  if (!questions || questions.length === 0) {
    if (!canGenerate) return null
    return (
      <section className="mt-8 flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-4">
        <p className="font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Discussion Questions
        </p>
        <p className="font-source-serif-4 text-sm text-text-secondary">
          Generate AI discussion questions for {bookTitle}.
        </p>
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerate}
            loading={pending}
          >
            Generate questions
          </Button>
        </div>
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="mt-8 rounded-lg border border-border-subtle bg-bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="font-dm-sans text-sm text-text-primary">
          {open ? 'Hide' : 'Show'} {questions.length} discussion questions
        </span>
        <span
          aria-hidden="true"
          className={`font-dm-mono text-xs text-text-tertiary transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-border-subtle p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-source-serif-4 text-sm text-text-secondary">
              Questions for {bookTitle}.
            </p>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy all'}
            </Button>
          </div>
          <ol className="flex flex-col gap-3">
            {questions.map((q, i) => (
              <li
                key={i}
                className="rounded-md border border-border-subtle bg-bg-sunken p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-source-serif-4 text-base text-text-primary">
                    <span className="mr-2 font-dm-mono text-xs text-text-tertiary">
                      {i + 1}.
                    </span>
                    {q.question}
                  </p>
                  {q.theme && <Badge variant="neutral">{q.theme}</Badge>}
                </div>
              </li>
            ))}
          </ol>
          {error && (
            <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
