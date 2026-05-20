'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DiscussionQuestion } from '@/lib/discussion-guide-types'
import { generateDiscussionGuide } from './actions'

interface Props {
  bookId: string
  bookSlug: string | null
  initialQuestions: DiscussionQuestion[] | null
}

export function DiscussionGuideSection({
  bookId,
  bookSlug,
  initialQuestions,
}: Props) {
  const [questions, setQuestions] = useState<DiscussionQuestion[] | null>(
    initialQuestions,
  )
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

  return (
    <section className="mt-10 border-t border-border-subtle pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-fraunces text-xl text-text-primary">
            Discussion Guide
          </h2>
          <p className="font-source-serif-4 text-sm text-text-secondary">
            Questions for your book club.
          </p>
        </div>
        {questions && questions.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="font-dm-mono text-xs text-text-tertiary">
              {questions.length} questions
            </span>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy all'}
            </Button>
          </div>
        )}
      </div>

      {!questions ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="font-source-serif-4 text-sm text-text-secondary">
            Generate a set of 12-15 discussion questions for this book.
          </p>
          <div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerate}
              loading={pending}
            >
              Generate discussion questions
            </Button>
          </div>
          {error && (
            <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}
        </div>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {questions.map((q, i) => (
            <li
              key={i}
              className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-surface p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-source-serif-4 text-base text-text-primary">
                  <span className="mr-2 font-dm-mono text-xs text-text-tertiary">
                    {i + 1}.
                  </span>
                  {q.question}
                </p>
                {q.theme && (
                  <Badge variant="neutral">{q.theme}</Badge>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
