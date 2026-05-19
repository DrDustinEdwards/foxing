'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  finishReadingSession,
  startReadingSession,
} from '@/app/book/[slug]/reading-session-actions'

interface Props {
  bookId: string
  bookSlug: string | null
  bookTitle: string
  wordCount: number | null
  totalPages?: number | null
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'active'; sessionId: string; startedAt: number }
  | { kind: 'finishing'; sessionId: string; durationMs: number }
  | {
      kind: 'complete'
      durationMinutes: number
      pagesRead: number
      avgWpm: number | null
    }

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

export function ReadingTimerWidget({
  bookId,
  bookSlug,
  bookTitle,
  wordCount,
  totalPages,
}: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [elapsed, setElapsed] = useState(0)
  const [pages, setPages] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (phase.kind !== 'active') return
    const startedAt = phase.startedAt
    setElapsed(Date.now() - startedAt)
    const i = window.setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 1000)
    return () => window.clearInterval(i)
  }, [phase])

  async function handleStart() {
    setError(null)
    setSaving(true)
    const fd = new FormData()
    fd.set('book_id', bookId)
    const res = await startReadingSession(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setPhase({ kind: 'active', sessionId: res.sessionId, startedAt: Date.now() })
  }

  function handleFinishStart() {
    if (phase.kind !== 'active') return
    setPhase({
      kind: 'finishing',
      sessionId: phase.sessionId,
      durationMs: elapsed,
    })
  }

  async function handleConfirmFinish() {
    if (phase.kind !== 'finishing') return
    setError(null)
    setSaving(true)
    const fd = new FormData()
    fd.set('session_id', phase.sessionId)
    fd.set('pages_read', pages || '0')
    if (wordCount) fd.set('word_count', String(wordCount))
    if (totalPages) fd.set('total_pages', String(totalPages))
    if (bookSlug) fd.set('book_slug', bookSlug)
    const res = await finishReadingSession(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setPhase({
      kind: 'complete',
      durationMinutes: res.durationMinutes,
      pagesRead: res.pagesRead,
      avgWpm: res.avgWpm,
    })
    setPages('')
  }

  function handleReset() {
    setPhase({ kind: 'idle' })
    setElapsed(0)
    setError(null)
  }

  return (
    <section className="mt-6 flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <p className="font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        Reading session
      </p>
      {phase.kind === 'idle' && (
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleStart}
          loading={saving}
        >
          Start reading {bookTitle.length > 24 ? 'session' : bookTitle}
        </Button>
      )}
      {phase.kind === 'active' && (
        <div className="flex flex-col gap-3">
          <p className="font-fraunces text-3xl text-text-primary tabular-nums">
            {formatDuration(elapsed)}
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleFinishStart}
          >
            I finished reading
          </Button>
        </div>
      )}
      {phase.kind === 'finishing' && (
        <div className="flex flex-col gap-2">
          <p className="font-source-serif-4 text-sm text-text-secondary">
            Read for {formatDuration(phase.durationMs)}. How many pages?
          </p>
          <Input
            label="Pages read"
            type="number"
            min={0}
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            placeholder="Optional"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={saving}
              onClick={handleConfirmFinish}
            >
              Save session
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {phase.kind === 'complete' && (
        <div className="flex flex-col gap-2">
          <p className="font-source-serif-4 text-sm text-text-secondary">
            Read for {phase.durationMinutes} min
            {phase.pagesRead > 0 && ` · ${phase.pagesRead} pages`}
            {phase.avgWpm !== null && ` · ~${phase.avgWpm} WPM`}
          </p>
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
            >
              Start another session
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
    </section>
  )
}
