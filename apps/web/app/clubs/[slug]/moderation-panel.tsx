'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  banClubMember,
  changeClubMemberRole,
  inviteClubMember,
  muteClubMember,
  removeClubMember,
} from './actions'

interface MemberView {
  user_id: string
  role: 'admin' | 'moderator' | 'member'
  status: 'active' | 'banned' | 'muted' | 'pending' | null
  muted_until: string | null
  banned_at: string | null
  username: string
  display_name: string
  avatar_url: string | null
}

interface Props {
  clubId: string
  isAdmin: boolean
  members: MemberView[]
}

export function ModerationPanel({ clubId, isAdmin, members }: Props) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Open moderation panel
      </Button>
    )
  }
  return (
    <section className="mt-6 flex flex-col gap-6 rounded-lg border border-border-subtle bg-bg-surface p-5">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-fraunces text-xl text-text-primary">Moderation</h2>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </header>
      <InvitePanel clubId={clubId} />
      <MembersPanel clubId={clubId} isAdmin={isAdmin} members={members} />
    </section>
  )
}

function InvitePanel({ clubId }: { clubId: string }) {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const fd = new FormData()
    fd.set('club_id', clubId)
    fd.set('identifier', identifier)
    const res = await inviteClubMember(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSent(true)
    setIdentifier('')
    setTimeout(() => setSent(false), 2500)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        Invite a member
      </h3>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <Input
            label="Username or email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="username or person@example.com"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={saving}
          disabled={!identifier.trim()}
        >
          Send invite
        </Button>
      </form>
      {error && (
        <p className="font-dm-sans text-sm text-error">{error}</p>
      )}
      {sent && (
        <p className="font-dm-sans text-sm text-success">Invite sent.</p>
      )}
    </div>
  )
}

function MembersPanel({
  clubId,
  isAdmin,
  members,
}: {
  clubId: string
  isAdmin: boolean
  members: MemberView[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        Members
      </h3>
      <ul className="flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
        {members.map((m) => (
          <li key={m.user_id} className="py-3">
            <MemberRow clubId={clubId} isAdmin={isAdmin} member={m} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function MemberRow({
  clubId,
  isAdmin,
  member,
}: {
  clubId: string
  isAdmin: boolean
  member: MemberView
}) {
  const router = useRouter()
  const [action, setAction] = useState<'idle' | 'mute' | 'ban'>('idle')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call(
    fn: (fd: FormData) => Promise<{ ok: boolean; error?: string }>,
    extra?: Record<string, string>,
  ) {
    setSaving(true)
    setError(null)
    const fd = new FormData()
    fd.set('club_id', clubId)
    fd.set('user_id', member.user_id)
    if (extra) for (const [k, v] of Object.entries(extra)) fd.set(k, v)
    const res = await fn(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error ?? 'Failed.')
      return
    }
    setAction('idle')
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
              @{member.username}
            </span>
          </div>
          <RoleBadge role={member.role} />
          {member.status === 'banned' && (
            <Badge variant="warning">Banned</Badge>
          )}
          {member.status === 'muted' && (
            <Badge variant="neutral">Muted</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <select
              defaultValue={member.role}
              onChange={(e) =>
                call(changeClubMemberRole, { role: e.target.value })
              }
              disabled={saving}
              className="rounded-md border border-border-default bg-bg-surface px-2 py-1 font-dm-sans text-xs text-text-primary"
            >
              <option value="member">member</option>
              <option value="moderator">moderator</option>
              <option value="admin">admin</option>
            </select>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAction(action === 'mute' ? 'idle' : 'mute')}
          >
            Mute
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAction(action === 'ban' ? 'idle' : 'ban')}
          >
            Ban
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm(`Remove @${member.username} from the club?`)) {
                call(removeClubMember)
              }
            }}
          >
            Remove
          </Button>
        </div>
      </div>

      {action === 'mute' && (
        <div className="rounded-md bg-bg-sunken p-3">
          <p className="font-dm-sans text-xs text-text-tertiary">
            Mute duration
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { h: 1, label: '1 hour' },
              { h: 24, label: '24 hours' },
              { h: 24 * 7, label: '7 days' },
              { h: 0, label: 'Permanent' },
            ].map((opt) => (
              <Button
                key={opt.label}
                variant="secondary"
                size="sm"
                disabled={saving}
                onClick={() =>
                  call(muteClubMember, { duration_hours: String(opt.h) })
                }
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {action === 'ban' && (
        <BanForm
          saving={saving}
          onCancel={() => setAction('idle')}
          onSubmit={(reason) => call(banClubMember, { reason })}
        />
      )}

      {error && (
        <p className="font-dm-sans text-sm text-error">{error}</p>
      )}
    </div>
  )
}

function BanForm({
  saving,
  onSubmit,
  onCancel,
}: {
  saving: boolean
  onSubmit: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (confirm('Ban this member from the club?')) onSubmit(reason.trim())
      }}
      className="rounded-md bg-bg-sunken p-3"
    >
      <Input
        label="Reason (required for audit trail)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        required
      />
      <div className="mt-2 flex gap-2">
        <Button
          type="submit"
          variant="danger"
          size="sm"
          loading={saving}
          disabled={!reason.trim()}
        >
          Ban member
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function RoleBadge({ role }: { role: MemberView['role'] }) {
  if (role === 'admin') return <Badge variant="brand">Admin</Badge>
  if (role === 'moderator') return <Badge variant="info">Mod</Badge>
  return null
}
