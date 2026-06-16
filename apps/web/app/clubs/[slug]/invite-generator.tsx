'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { generateClubInvite } from './actions'

interface Props {
  clubId: string
  clubSlug: string
}

export function InviteGenerator({ clubId, clubSlug }: Props) {
  const [pending, setPending] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setError(null)
    setCopied(false)
    setPending(true)
    const fd = new FormData()
    fd.set('club_id', clubId)
    const res = await generateClubInvite(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setLink(
      `${window.location.origin}/clubs/${clubSlug}/join?code=${res.code}`,
    )
  }

  async function handleCopy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setError('Copy failed. Select the link and copy it manually.')
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <p className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
        Invite members
      </p>
      <p className="font-source-serif-4 text-sm text-text-secondary">
        Generate a shareable link. Anyone signed in can join with it. The link
        expires in 7 days.
      </p>
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={pending}
          onClick={handleGenerate}
        >
          {link ? 'Generate another link' : 'Generate invite link'}
        </Button>
      </div>
      {link && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-md border border-border-subtle bg-bg-sunken px-3 py-2 font-dm-mono text-xs text-text-secondary"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      )}
      {error && <p className="font-dm-sans text-xs text-error">{error}</p>}
    </div>
  )
}
