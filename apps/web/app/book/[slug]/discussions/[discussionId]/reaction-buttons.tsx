'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { togglePostReaction } from '../../actions'
import { cn } from '@/lib/cn'

const REACTIONS = ['👍', '❤️', '😂', '😢', '🤔', '🔥'] as const

interface ReactionView {
  reaction: string
  count: number
  users: string[]
}

interface Props {
  postId: string
  bookSlug: string
  discussionId: string
  viewerId: string | null
  reactions: ReactionView[]
}

export function ReactionButtons({
  postId,
  bookSlug,
  discussionId,
  viewerId,
  reactions,
}: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  async function handleClick(reaction: string) {
    if (!viewerId) return
    setPending(reaction)
    const fd = new FormData()
    fd.set('post_id', postId)
    fd.set('reaction', reaction)
    fd.set('book_slug', bookSlug)
    fd.set('discussion_id', discussionId)
    await togglePostReaction(fd)
    setPending(null)
    setPickerOpen(false)
    router.refresh()
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {reactions.map((r) => {
        const reacted =
          viewerId !== null && r.users.includes(viewerId)
        return (
          <button
            key={r.reaction}
            type="button"
            disabled={!viewerId || pending !== null}
            onClick={() => handleClick(r.reaction)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-dm-mono text-xs transition-colors',
              reacted
                ? 'border-brand-ui bg-brand-subtle text-brand-subtle-text'
                : 'border-border-subtle bg-bg-surface text-text-secondary hover:border-border-interactive',
              !viewerId && 'cursor-default opacity-70',
            )}
          >
            <span>{r.reaction}</span>
            <span>{r.count}</span>
          </button>
        )
      })}
      {viewerId && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-full border border-border-subtle px-2 py-0.5 font-dm-mono text-xs text-text-tertiary hover:border-border-interactive hover:text-text-primary"
          >
            + react
          </button>
          {pickerOpen && (
            <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-full border border-border-subtle bg-bg-elevated p-1 shadow-md">
              {REACTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleClick(r)}
                  className="rounded-full px-2 py-1 text-base hover:bg-bg-hover"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
