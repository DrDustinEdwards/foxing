'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { updateVisibility } from './actions'

interface Props {
  initial: {
    is_public: boolean
    progress_is_public: boolean
  }
}

export function VisibilitySection({ initial }: Props) {
  const [isPublic, setIsPublic] = useState(initial.is_public)
  const [progressPublic, setProgressPublic] = useState(initial.progress_is_public)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)
    const fd = new FormData()
    fd.set('is_public', String(isPublic))
    fd.set('progress_is_public', String(progressPublic))
    const res = await updateVisibility(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error ?? 'Save failed.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ToggleRow
        id="is_public"
        checked={isPublic}
        onChange={setIsPublic}
        label="Public profile"
        subtext="Other readers can see your library, diary, and highlights."
      />
      <ToggleRow
        id="progress_is_public"
        checked={progressPublic}
        onChange={setProgressPublic}
        label="Share reading progress"
        subtext="Show what you're currently reading on your profile."
      />
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={saving}>
          Save changes
        </Button>
        {saved && (
          <span className="font-dm-mono text-xs text-success">Saved</span>
        )}
      </div>
    </form>
  )
}

function ToggleRow({
  id,
  checked,
  onChange,
  label,
  subtext,
}: {
  id: string
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  subtext: string
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-md border border-border-subtle bg-bg-surface p-3"
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-border-interactive accent-toggle-on"
      />
      <div className="flex flex-col">
        <span className="font-dm-sans text-sm font-medium text-text-primary">
          {label}
        </span>
        <span className="font-dm-sans text-xs text-text-tertiary">
          {subtext}
        </span>
      </div>
    </label>
  )
}
