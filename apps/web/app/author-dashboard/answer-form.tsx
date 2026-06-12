'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ignoreAuthorQuestion, publishAnswer } from './actions'

export function AnswerForm({ questionId }: { questionId: string }) {
  const router = useRouter()
  const [answer, setAnswer] = useState('')
  const [pending, setPending] = useState<'publish' | 'ignore' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    if (!answer.trim()) return
    setError(null)
    setPending('publish')
    const fd = new FormData()
    fd.set('question_id', questionId)
    fd.set('answer', answer)
    const res = await publishAnswer(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  async function handleIgnore() {
    if (!confirm('Hide this question without answering?')) return
    setError(null)
    setPending('ignore')
    const fd = new FormData()
    fd.set('question_id', questionId)
    const res = await ignoreAuthorQuestion(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <form onSubmit={handlePublish} className="flex flex-col gap-2">
      <textarea
        aria-label="Your answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Your answer..."
        className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-base text-text-primary"
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={pending === 'publish'}
          disabled={!answer.trim()}
        >
          Publish answer
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={pending === 'ignore'}
          onClick={handleIgnore}
        >
          Ignore
        </Button>
      </div>
      {error && (
        <p className="font-dm-sans text-xs text-error">{error}</p>
      )}
    </form>
  )
}
