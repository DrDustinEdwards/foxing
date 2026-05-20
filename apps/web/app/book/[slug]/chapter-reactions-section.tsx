'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  REACTION_EMOJIS,
  type ChapterReaction,
  type ReactionEmoji,
  type ReactionPrivacy,
} from '@/lib/chapter-reactions-types'
import {
  addChapterReaction,
  deleteChapterReaction,
} from './actions'
import { cn } from '@/lib/cn'

interface Props {
  bookId: string
  bookSlug: string | null
  reactions: ChapterReaction[]
}

const PRIVACY_LABEL: Record<ReactionPrivacy, string> = {
  public: 'Public',
  close_friends: 'Close friends',
  private: 'Private',
}

export function ChapterReactionsSection({
  bookId,
  bookSlug,
  reactions,
}: Props) {
  const router = useRouter()
  const [chapterName, setChapterName] = useState('')
  const [emoji, setEmoji] = useState<ReactionEmoji | null>(null)
  const [note, setNote] = useState('')
  const [privacy, setPrivacy] = useState<ReactionPrivacy>('public')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!chapterName.trim() || !emoji) {
      setError('Pick a chapter and an emoji.')
      return
    }
    setSaving(true)
    const fd = new FormData()
    fd.set('book_id', bookId)
    if (bookSlug) fd.set('book_slug', bookSlug)
    fd.set('chapter_name', chapterName)
    fd.set('emoji', emoji)
    if (note) fd.set('note', note)
    fd.set('privacy', privacy)
    const res = await addChapterReaction(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setChapterName('')
    setEmoji(null)
    setNote('')
    setPrivacy('public')
    router.refresh()
  }

  async function handleDelete(reactionId: string) {
    if (!confirm('Delete this reaction?')) return
    const fd = new FormData()
    fd.set('reaction_id', reactionId)
    if (bookSlug) fd.set('book_slug', bookSlug)
    await deleteChapterReaction(fd)
    router.refresh()
  }

  return (
    <section className="mt-10 border-t border-border-subtle pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-fraunces text-xl text-text-primary">
          Chapter reactions
        </h2>
        <p className="font-source-serif-4 text-sm text-text-tertiary">
          How did each chapter make you feel?
        </p>
      </div>

      {reactions.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {reactions.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 rounded-md border border-border-subtle bg-bg-surface p-3"
            >
              <span aria-hidden="true" className="text-2xl">
                {r.emoji}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="font-fraunces text-sm text-text-primary">
                  {r.chapter_name}
                </p>
                {r.note && (
                  <p className="whitespace-pre-line font-source-serif-4 text-sm text-text-secondary">
                    {r.note}
                  </p>
                )}
                <span className="font-dm-mono text-[10px] uppercase tracking-wider text-text-tertiary">
                  {PRIVACY_LABEL[r.privacy]}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                className="font-dm-mono text-xs text-text-tertiary hover:text-error"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
      >
        <Input
          label="Chapter"
          value={chapterName}
          onChange={(e) => setChapterName(e.target.value)}
          placeholder="e.g. Chapter 12 or Part Two"
          required
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="font-dm-sans text-sm text-text-secondary">
            How did it make you feel?
          </legend>
          <div className="flex flex-wrap gap-2">
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={cn(
                  'h-12 w-12 rounded-md border text-2xl transition-colors',
                  emoji === e
                    ? 'border-brand-ui bg-brand-subtle'
                    : 'border-border-default bg-bg-surface hover:border-border-interactive',
                )}
                aria-pressed={emoji === e}
                aria-label={`React with ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="chapter-reaction-note"
            className="font-dm-sans text-sm text-text-secondary"
          >
            Note (optional)
          </label>
          <textarea
            id="chapter-reaction-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="What happened? How did it make you feel?"
            className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
          />
        </div>
        <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
          <span>Privacy</span>
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as ReactionPrivacy)}
            className="rounded-md border border-border-default bg-bg-surface px-2 py-1.5 text-text-primary"
          >
            <option value="public">Public</option>
            <option value="close_friends">Close friends</option>
            <option value="private">Private</option>
          </select>
        </label>
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
        <div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={saving}
            disabled={!emoji || !chapterName.trim()}
          >
            Add reaction
          </Button>
        </div>
      </form>
    </section>
  )
}
