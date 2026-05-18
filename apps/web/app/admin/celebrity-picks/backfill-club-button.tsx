'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { triggerClubBackfill } from './actions'

interface State {
  status: 'idle' | 'running' | 'done' | 'error'
  message: string | null
}

export function BackfillClubButton({
  clubs,
}: {
  clubs: Array<{ slug: string; name: string }>
}) {
  const router = useRouter()
  const initialSlug = clubs[0]?.slug ?? ''
  const [slug, setSlug] = useState(initialSlug)
  const [state, setState] = useState<State>({ status: 'idle', message: null })

  async function handleClick() {
    if (!slug) return
    setState({ status: 'running', message: null })
    const res = await triggerClubBackfill(slug)
    if (!res.ok) {
      setState({ status: 'error', message: res.error ?? 'Backfill failed.' })
      return
    }
    setState({ status: 'done', message: res.message ?? 'Done.' })
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
        <span className="sr-only">Club to backfill</span>
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={state.status === 'running' || clubs.length === 0}
          className="rounded-md border border-border-default bg-bg-surface px-2 py-1.5 font-dm-sans text-sm text-text-primary"
        >
          {clubs.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleClick}
        loading={state.status === 'running'}
        disabled={state.status === 'running' || !slug}
      >
        {state.status === 'running' ? 'Backfilling...' : 'Backfill picks'}
      </Button>
      {state.status === 'done' && state.message && (
        <span className="font-dm-sans text-sm text-success">
          {state.message}
        </span>
      )}
      {state.status === 'error' && state.message && (
        <span className="font-dm-sans text-sm text-error">{state.message}</span>
      )}
    </div>
  )
}
