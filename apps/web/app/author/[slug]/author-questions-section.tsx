'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  askAuthorQuestion,
  toggleQuestionUpvote,
} from '@/app/author-dashboard/actions'
import type { AuthorQuestionWithMeta } from '@/lib/author-qa-types'

interface Props {
  authorUserId: string
  authorName: string
  initial: AuthorQuestionWithMeta[]
  canAsk: boolean
}

export function AuthorQuestionsSection({
  authorUserId,
  authorName,
  initial,
  canAsk,
}: Props) {
  const router = useRouter()
  const [questions, setQuestions] = useState(initial)
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (text.trim().length < 10) {
      setError('Question must be at least 10 characters.')
      return
    }
    setPending(true)
    const fd = new FormData()
    fd.set('author_user_id', authorUserId)
    fd.set('question', text.trim())
    const res = await askAuthorQuestion(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setText('')
    setSubmitted(true)
    router.refresh()
  }

  async function handleUpvote(questionId: string) {
    const next = questions.map((q) =>
      q.id === questionId
        ? {
            ...q,
            viewer_upvoted: !q.viewer_upvoted,
            upvote_count: q.upvote_count + (q.viewer_upvoted ? -1 : 1),
          }
        : q,
    )
    setQuestions(next)
    const fd = new FormData()
    fd.set('question_id', questionId)
    const res = await toggleQuestionUpvote(fd)
    if (!res.ok) {
      setQuestions(questions)
      setError(res.error)
    }
  }

  return (
    <section className="mt-12 border-t border-border-subtle pt-8">
      <h2 className="font-fraunces text-xl text-text-primary">
        Q&amp;A with {authorName}
      </h2>
      {questions.length === 0 ? (
        <p className="mt-3 font-source-serif-4 text-base text-text-tertiary">
          No questions answered yet.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {questions.map((q) => (
            <li
              key={q.id}
              className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-source-serif-4 text-base text-text-primary">
                  {q.question}
                </p>
                <button
                  type="button"
                  onClick={() => handleUpvote(q.id)}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-border-subtle bg-bg-sunken px-2 py-0.5 font-dm-mono text-xs text-text-tertiary hover:bg-bg-hover"
                  aria-pressed={q.viewer_upvoted}
                >
                  <span aria-hidden="true">
                    {q.viewer_upvoted ? '▲' : '△'}
                  </span>
                  {q.upvote_count}
                </button>
              </div>
              {q.asker && (
                <p className="font-dm-sans text-xs text-text-tertiary">
                  Asked by{' '}
                  <Link
                    href={`/u/${q.asker.username}`}
                    className="hover:underline"
                  >
                    @{q.asker.username}
                  </Link>
                </p>
              )}
              {q.answer && (
                <div className="mt-2 flex gap-3 rounded-md bg-bg-sunken p-3">
                  <Avatar src={null} name={authorName} size="sm" />
                  <p className="font-source-serif-4 text-sm text-text-primary">
                    {q.answer}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAsk && (
        <form onSubmit={handleAsk} className="mt-6 flex flex-col gap-2">
          <label
            htmlFor="ask-question"
            className="font-dm-sans text-sm text-text-secondary"
          >
            Ask {authorName} a question
          </label>
          <textarea
            id="ask-question"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="What would you like to ask?"
            className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-base text-text-primary"
          />
          {submitted && (
            <p className="font-dm-sans text-xs text-success">
              Question submitted.
            </p>
          )}
          {error && (
            <p className="font-dm-sans text-xs text-error">{error}</p>
          )}
          <div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={pending}
              disabled={text.trim().length < 10}
            >
              Submit question
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
