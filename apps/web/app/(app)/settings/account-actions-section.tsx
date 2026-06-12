'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteAccount } from './actions'

interface Props {
  username: string
}

export function AccountActionsSection({ username }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleExport() {
    window.location.assign('/api/account/export')
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (confirmText !== 'DELETE') {
      setError('Type DELETE to confirm.')
      return
    }
    setPending(true)
    const fd = new FormData()
    fd.set('confirmation', confirmText)
    const res = await deleteAccount(fd)
    setPending(false)
    if (res && !res.ok) {
      setError(res.error ?? 'Delete failed.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Button variant="secondary" size="md" onClick={handleExport}>
          Export my data
        </Button>
        <p className="font-dm-sans text-xs text-text-tertiary">
          Downloads a JSON archive of your account data.
        </p>
      </div>

      <div className="rounded-md border border-[var(--error-border-interactive)] bg-error-bg p-4">
        <p className="font-fraunces text-base text-error">Delete account</p>
        <p className="mt-1 font-dm-sans text-sm text-text-secondary">
          This removes @{username} and every book, highlight, review, and
          diary entry attached to it. There is no undo.
        </p>
        {!confirmOpen ? (
          <Button
            variant="danger"
            size="sm"
            className="mt-3"
            onClick={() => setConfirmOpen(true)}
          >
            Delete account
          </Button>
        ) : (
          <form onSubmit={handleDelete} className="mt-3 flex flex-col gap-3">
            <Input
              label="Type DELETE to confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            {error && (
              <p className="font-dm-sans text-sm text-error">{error}</p>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="danger"
                size="sm"
                loading={pending}
                disabled={confirmText !== 'DELETE'}
              >
                Permanently delete
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmOpen(false)
                  setConfirmText('')
                  setError(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
