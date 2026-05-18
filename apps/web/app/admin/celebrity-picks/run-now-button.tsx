'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { triggerCelebrityPicksCron } from './actions'

interface State {
  status: 'idle' | 'running' | 'done' | 'error'
  message: string | null
}

export function RunNowButton() {
  const router = useRouter()
  const [state, setState] = useState<State>({ status: 'idle', message: null })

  async function handleClick() {
    setState({ status: 'running', message: null })
    const res = await triggerCelebrityPicksCron()
    if (!res.ok) {
      setState({ status: 'error', message: res.error ?? 'Run failed.' })
      return
    }
    setState({
      status: 'done',
      message: res.message ?? 'Done.',
    })
    router.refresh()
  }

  const label =
    state.status === 'running' ? 'Finding picks...' : 'Find picks now'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="primary"
        size="md"
        onClick={handleClick}
        loading={state.status === 'running'}
        disabled={state.status === 'running'}
      >
        <RefreshIcon />
        {label}
      </Button>
      {state.status === 'done' && state.message && (
        <span className="font-dm-sans text-sm text-success">
          {state.message}
        </span>
      )}
      {state.status === 'error' && state.message && (
        <span className="font-dm-sans text-sm text-error">
          {state.message}
        </span>
      )}
    </div>
  )
}

function RefreshIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}
