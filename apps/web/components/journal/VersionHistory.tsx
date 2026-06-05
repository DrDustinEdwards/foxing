'use client'

import { useEffect, useState } from 'react'

interface Version {
  id: string
  saved_at: string
  title: string
  content: string
}

interface Props {
  postId: string
  onRestore: (content: string, title: string, excerpt: string) => void
}

export function VersionHistory({ postId, onRestore }: Props) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch(`/api/admin/journal/posts/${postId}/versions`)
      .then((r) => r.json())
      .then((d: { versions?: Version[] }) => {
        if (!alive) return
        setVersions(d.versions ?? [])
        setLoading(false)
      })
      .catch(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [postId])

  if (loading) {
    return (
      <p className="mt-2 font-dm-mono text-xs text-text-tertiary">Loading...</p>
    )
  }
  if (versions.length === 0) {
    return (
      <p className="mt-2 font-dm-mono text-xs text-text-tertiary">
        No versions saved yet.
      </p>
    )
  }

  return (
    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
      {versions.map((v) => (
        <li
          key={v.id}
          className="flex items-center justify-between gap-3 border-b border-border-subtle py-1 font-dm-mono text-xs text-text-tertiary last:border-0"
        >
          <span>
            {new Date(v.saved_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span className="opacity-60">
            {v.content.length.toLocaleString()} chars
          </span>
          <button
            type="button"
            onClick={() => {
              if (
                !window.confirm(
                  `Restore this version from ${new Date(v.saved_at).toLocaleString()}? Current changes will be overwritten.`,
                )
              )
                return
              onRestore(v.content, v.title, '')
            }}
            className="cursor-pointer font-dm-mono text-xs text-brand-text hover:opacity-80"
          >
            Restore
          </button>
        </li>
      ))}
    </ul>
  )
}
