'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/select'
import { changeClubMemberRole, removeClubMember } from './actions'

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Admin' },
]

interface Props {
  clubId: string
  userId: string
  role: 'admin' | 'moderator' | 'member'
  canManageRole: boolean
  canRemove: boolean
}

export function MemberManageControls({
  clubId,
  userId,
  role,
  canManageRole,
  canRemove,
}: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRole(next: string) {
    if (next === role) return
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('club_id', clubId)
    fd.set('user_id', userId)
    fd.set('role', next)
    const res = await changeClubMemberRole(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  async function handleRemove() {
    if (!confirm('Remove this member from the club?')) return
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('club_id', clubId)
    fd.set('user_id', userId)
    const res = await removeClubMember(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {canManageRole && (
          <Select
            aria-label="Member role"
            options={ROLE_OPTIONS}
            value={role}
            onChange={handleRole}
            size="sm"
            disabled={pending}
          />
        )}
        {canRemove && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={pending}
            className="font-dm-mono text-xs text-text-tertiary hover:text-error disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="font-dm-sans text-xs text-error">{error}</p>}
    </div>
  )
}
