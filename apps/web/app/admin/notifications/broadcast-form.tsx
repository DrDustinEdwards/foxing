'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendBroadcast } from './actions'

type Target = 'all' | 'plus' | 'patron'

export function BroadcastForm() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState<Target>('all')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    if (
      !window.confirm(
        `Send "${title}" to ${target === 'all' ? 'all users' : `${target} subscribers`}?`,
      )
    )
      return
    setPending(true)
    const res = await sendBroadcast({ title, body, target })
    setPending(false)
    if (!res.ok) {
      setError(res.error ?? 'Send failed.')
      return
    }
    setResult(`Sent to ${res.sent ?? 0} users.`)
    setTitle('')
    setBody('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={120}
        placeholder="e.g. New on Foxing: Reading personality"
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="body"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Body
        </label>
        <textarea
          id="body"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={600}
          required
          placeholder="One short paragraph. No exclamation marks."
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
        <span className="font-dm-mono text-xs text-text-tertiary">
          {body.length} / 600
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="target"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Send to
        </label>
        <select
          id="target"
          value={target}
          onChange={(e) => setTarget(e.target.value as Target)}
          className="h-10 rounded-md border border-border-interactive bg-bg-surface px-2 font-dm-sans text-sm text-text-primary"
        >
          <option value="all">All users</option>
          <option value="plus">Plus subscribers</option>
          <option value="patron">Patron subscribers</option>
        </select>
      </div>

      {title && body && (
        <div className="rounded-md border border-border-subtle bg-bg-sunken p-3">
          <p className="font-dm-mono text-[11px] uppercase tracking-wide text-text-tertiary">
            Preview
          </p>
          <p className="mt-1 font-fraunces text-base text-text-primary">
            {title}
          </p>
          <p className="mt-1 font-source-serif-4 text-sm text-text-secondary">
            {body}
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      {result && (
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          {result}
        </p>
      )}

      <div>
        <Button type="submit" variant="primary" loading={pending}>
          Send
        </Button>
      </div>
    </form>
  )
}
