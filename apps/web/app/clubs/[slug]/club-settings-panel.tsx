'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ClubSectionHeader } from './club-section-header'
import {
  deleteClub,
  testClubDiscordWebhook,
  transferClubOwnership,
  updateClubDiscordWebhook,
  updateClubSettings,
} from './actions'

interface ClubData {
  id: string
  name: string
  description: string | null
  visibility: string
  member_approval: boolean | null
  max_members: number | null
  reading_pace: string | null
  chapters_per_week: number | null
  genre_tags: string[] | null
  current_book_id: string | null
  discord_webhook_url: string | null
}

export function ClubSettingsPanel({ club }: { club: ClubData }) {
  return (
    <section>
      <ClubSectionHeader title="Club Settings" />
      <div className="flex flex-col gap-6">
        <GeneralForm club={club} />
        <DiscordWebhookBlock
          clubId={club.id}
          webhookUrl={club.discord_webhook_url}
        />
        <TransferOwnershipBlock clubId={club.id} />
        <DangerZone clubId={club.id} clubName={club.name} />
      </div>
    </section>
  )
}

function maskWebhook(url: string): string {
  const lastSlash = url.lastIndexOf('/')
  if (lastSlash < 0) return url
  return `${url.slice(0, lastSlash + 7)}...`
}

function DiscordWebhookBlock({
  clubId,
  webhookUrl,
}: {
  clubId: string
  webhookUrl: string | null
}) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [pending, setPending] = useState<'save' | 'test' | 'clear' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const configured = Boolean(webhookUrl)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!value.trim()) {
      setError('Webhook URL is required.')
      return
    }
    setPending('save')
    const fd = new FormData()
    fd.set('club_id', clubId)
    fd.set('webhook_url', value.trim())
    const res = await updateClubDiscordWebhook(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setValue('')
    setInfo('Webhook configured ✓')
    router.refresh()
  }

  async function handleClear() {
    if (!confirm('Disconnect this club from Discord?')) return
    setError(null)
    setInfo(null)
    setPending('clear')
    const fd = new FormData()
    fd.set('club_id', clubId)
    fd.set('clear', 'true')
    const res = await updateClubDiscordWebhook(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setInfo('Discord disconnected.')
    router.refresh()
  }

  async function handleTest() {
    setError(null)
    setInfo(null)
    setPending('test')
    const fd = new FormData()
    fd.set('club_id', clubId)
    const res = await testClubDiscordWebhook(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setInfo('Test message sent.')
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border-subtle pt-5">
      <header>
        <h3 className="font-fraunces text-lg text-text-primary">
          Discord notifications
        </h3>
        <p className="font-source-serif-4 text-sm text-text-secondary">
          Send new meetings, polls, and announcements to a Discord channel.
        </p>
      </header>
      {configured ? (
        <div className="flex flex-col gap-3">
          <p className="font-dm-mono text-xs text-text-tertiary">
            {maskWebhook(webhookUrl!)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={pending === 'test'}
              onClick={handleTest}
            >
              Send test
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={pending === 'clear'}
              onClick={handleClear}
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-2">
          <Input
            label="Webhook URL"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
          />
          <div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={pending === 'save'}
              disabled={!value.trim()}
            >
              Connect
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      {info && (
        <p className="font-dm-sans text-xs text-success">{info}</p>
      )}
    </section>
  )
}

function GeneralForm({ club }: { club: ClubData }) {
  const router = useRouter()
  const [pace, setPace] = useState(club.reading_pace ?? 'moderate')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    fd.set('club_id', club.id)
    fd.set('reading_pace', pace)
    const res = await updateClubSettings(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h3 className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
        General
      </h3>
      <Input
        label="Club name"
        name="name"
        defaultValue={club.name}
        maxLength={80}
        required
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="club-description"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Description
        </label>
        <textarea
          id="club-description"
          name="description"
          defaultValue={club.description ?? ''}
          maxLength={500}
          rows={3}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-dm-sans text-sm text-text-secondary">
          Visibility
        </legend>
        <div className="flex flex-wrap gap-3 font-dm-sans text-sm text-text-secondary">
          {(['public', 'private', 'secret'] as const).map((v) => (
            <label key={v} className="flex items-center gap-2">
              <input
                type="radio"
                name="visibility"
                value={v}
                defaultChecked={club.visibility === v}
              />
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
        <input
          type="checkbox"
          name="member_approval"
          defaultChecked={club.member_approval ?? false}
        />
        Require admin approval to join
      </label>
      <Input
        label="Member limit (leave blank for unlimited)"
        name="max_members"
        type="number"
        min={1}
        defaultValue={club.max_members ?? ''}
      />
      <label className="flex flex-col gap-1.5 font-dm-sans text-sm text-text-secondary">
        <span>Reading pace</span>
        <Select
          name="_pace"
          value={pace}
          onChange={(v) => setPace(v)}
          size="md"
          options={[
            { value: 'relaxed', label: 'Relaxed' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'intensive', label: 'Intensive' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
      </label>
      {pace === 'custom' && (
        <Input
          label="Chapters per week"
          name="chapters_per_week"
          type="number"
          min={1}
          defaultValue={club.chapters_per_week ?? ''}
        />
      )}
      <Input
        label="Genre tags (comma-separated)"
        name="genre_tags"
        defaultValue={(club.genre_tags ?? []).join(', ')}
        placeholder="gothic, romance, mystery"
      />
      <Input
        label="Current book ID (optional)"
        name="current_book_id"
        defaultValue={club.current_book_id ?? ''}
        hint="Paste a book UUID to set the club's current read."
      />
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Save changes
        </Button>
        {saved && (
          <span className="font-dm-mono text-xs text-success">Saved</span>
        )}
      </div>
    </form>
  )
}

function TransferOwnershipBlock({ clubId }: { clubId: string }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!confirmed) {
      setError('Confirm by checking the box.')
      return
    }
    setPending(true)
    const fd = new FormData()
    fd.set('club_id', clubId)
    fd.set('username', username.replace(/^@/, ''))
    fd.set('confirm', 'on')
    const res = await transferClubOwnership(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setConfirmOpen(false)
    setUsername('')
    setConfirmed(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
      <h3 className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
        Transfer ownership
      </h3>
      {!confirmOpen ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
        >
          Transfer ownership to another member
        </Button>
      ) : (
        <form onSubmit={handleTransfer} className="flex flex-col gap-2">
          <Input
            label="Member username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            required
          />
          <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I understand this action cannot be undone
          </label>
          {error && (
            <p className="font-dm-sans text-sm text-error">{error}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={pending}
              disabled={!confirmed || !username.trim()}
            >
              Transfer
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setConfirmOpen(false)
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

function DangerZone({
  clubId,
  clubName,
}: {
  clubId: string
  clubName: string
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const fd = new FormData(e.currentTarget)
    fd.set('club_id', clubId)
    fd.set('confirm_name', typed)
    try {
      await deleteClub(fd)
    } catch (err) {
      setPending(false)
      setError(err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  return (
    <div className="rounded-md border border-[var(--error-border-interactive)] bg-error-bg p-4">
      <p className="font-fraunces text-base text-error">Danger zone</p>
      <p className="mt-1 font-dm-sans text-sm text-text-secondary">
        Deleting a club is permanent. Posts, announcements, meetings, polls,
        and members are removed with it.
      </p>
      {!confirmOpen ? (
        <Button
          variant="danger"
          size="sm"
          className="mt-3"
          onClick={() => setConfirmOpen(true)}
        >
          Delete this club
        </Button>
      ) : (
        <form onSubmit={handleDelete} className="mt-3 flex flex-col gap-2">
          <Input
            label={`Type "${clubName}" to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
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
              disabled={typed.toLowerCase() !== clubName.toLowerCase()}
            >
              Permanently delete club
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setConfirmOpen(false)
                setTyped('')
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
