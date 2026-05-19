'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatRelativeDate } from '@foxing/utils'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { approveClubMember, declineClubMember } from './actions'

export interface PendingMemberView {
  user_id: string
  joined_at: string
  username: string
  display_name: string
  avatar_url: string | null
}

export function PendingMembersPanel({
  clubId,
  pending,
}: {
  clubId: string
  pending: PendingMemberView[]
}) {
  if (pending.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Pending requests
        </h3>
        <p className="font-source-serif-4 text-sm text-text-tertiary">
          No pending requests.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        Pending requests ({pending.length})
      </h3>
      <ul className="flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
        {pending.map((m) => (
          <li key={m.user_id} className="py-3">
            <PendingRow clubId={clubId} member={m} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function PendingRow({
  clubId,
  member,
}: {
  clubId: string
  member: PendingMemberView
}) {
  const router = useRouter()
  const [pending, setPending] = useState<'approve' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(
    fn: (fd: FormData) => Promise<{ ok: boolean; error?: string }>,
    label: 'approve' | 'decline',
  ) {
    setError(null)
    setPending(label)
    const fd = new FormData()
    fd.set('club_id', clubId)
    fd.set('user_id', member.user_id)
    const res = await fn(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error ?? 'Action failed.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar
            src={member.avatar_url}
            name={member.display_name}
            size="sm"
          />
          <div className="flex flex-col leading-tight">
            <span className="font-dm-sans text-sm text-text-primary">
              {member.display_name}
            </span>
            <span className="font-dm-mono text-xs text-text-tertiary">
              @{member.username} · requested {formatRelativeDate(member.joined_at)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={pending === 'approve'}
            onClick={() => act(approveClubMember, 'approve')}
          >
            Approve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={pending === 'decline'}
            onClick={() => act(declineClubMember, 'decline')}
          >
            Decline
          </Button>
        </div>
      </div>
      {error && (
        <p className="font-dm-sans text-xs text-error">{error}</p>
      )}
    </div>
  )
}
