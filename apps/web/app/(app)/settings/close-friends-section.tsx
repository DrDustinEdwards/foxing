'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addCloseFriend,
  removeCloseFriend,
} from './close-friends-actions'

interface Friend {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
}

interface UserHit {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

async function searchUsers(query: string): Promise<UserHit[]> {
  const res = await fetch(
    `/api/search/users?q=${encodeURIComponent(query)}&limit=8`,
  )
  if (!res.ok) return []
  return (await res.json()) as UserHit[]
}

export function CloseFriendsSection({ friends }: { friends: Friend[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<UserHit[]>([])
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const debouncer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debouncer.current) clearTimeout(debouncer.current)
    if (query.trim().length < 2) {
      setHits([])
      return
    }
    debouncer.current = setTimeout(async () => {
      const results = await searchUsers(query.trim())
      setHits(results.filter((u) => !friends.some((f) => f.user_id === u.id)))
      setOpen(true)
    }, 250)
  }, [query, friends])

  async function handleAdd(u: UserHit) {
    setError(null)
    setPending(u.id)
    const fd = new FormData()
    fd.set('friend_id', u.id)
    const res = await addCloseFriend(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setQuery('')
    setOpen(false)
    router.refresh()
  }

  async function handleRemove(friendId: string) {
    setError(null)
    setPending(friendId)
    const fd = new FormData()
    fd.set('friend_id', friendId)
    const res = await removeCloseFriend(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-source-serif-4 text-sm text-text-secondary">
        Close friends can see your private passage comments and chapter
        reactions marked as &quot;close friends only&quot;.
      </p>

      {friends.length === 0 ? (
        <p className="font-source-serif-4 text-sm text-text-tertiary">
          No close friends yet. Add people you follow.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
          {friends.map((f) => (
            <li
              key={f.user_id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  src={f.avatar_url}
                  name={f.display_name}
                  size="sm"
                />
                <div className="flex flex-col leading-tight">
                  <span className="font-dm-sans text-sm text-text-primary">
                    {f.display_name}
                  </span>
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    @{f.username}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                loading={pending === f.user_id}
                onClick={() => handleRemove(f.user_id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Input
          label="Add a close friend"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search someone you follow"
          autoComplete="off"
        />
        {open && hits.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border-default bg-bg-elevated shadow-md">
            {hits.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => handleAdd(u)}
                  disabled={pending === u.id}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-bg-hover disabled:opacity-50"
                >
                  <Avatar
                    src={u.avatar_url}
                    name={u.display_name}
                    size="sm"
                  />
                  <span className="flex flex-col">
                    <span className="font-dm-sans text-sm text-text-primary">
                      {u.display_name}
                    </span>
                    <span className="font-dm-mono text-xs text-text-tertiary">
                      @{u.username}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}
