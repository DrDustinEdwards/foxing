'use client'

import { type ChangeEvent, useEffect, useState } from 'react'
import type { SelectionState } from '../editor-actions'
import { ShortcodePanel } from './ShortcodePanel'
import { Toolbar } from './Toolbar'
import type { LinkedPost } from './types'

export function BodyField({
  textareaRef,
  content,
  setContent,
  previewHtml,
  words,
  minutes,
  applyAction,
  onImagePick,
  uploading,
  onShowFullPreview,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  content: string
  setContent: (v: string) => void
  previewHtml: string
  words: number
  minutes: number
  applyAction: (fn: (s: SelectionState) => SelectionState) => void
  onImagePick: (e: ChangeEvent<HTMLInputElement>) => void
  uploading: boolean
  onShowFullPreview: () => void
}) {
  const [mention, setMention] = useState<{
    query: string
    start: number
  } | null>(null)
  const [mentionResults, setMentionResults] = useState<LinkedPost[]>([])
  const [mentionLoading, setMentionLoading] = useState(false)

  useEffect(() => {
    if (!mention) {
      setMentionResults([])
      return
    }
    const q = mention.query.trim()
    if (!q) {
      setMentionResults([])
      return
    }
    let alive = true
    const handle = window.setTimeout(async () => {
      setMentionLoading(true)
      try {
        const res = await fetch(
          `/api/admin/journal/posts/search?q=${encodeURIComponent(q)}`,
        )
        if (!res.ok) return
        const data = (await res.json()) as { results?: LinkedPost[] }
        if (alive) setMentionResults(data.results ?? [])
      } finally {
        if (alive) setMentionLoading(false)
      }
    }, 200)
    return () => {
      alive = false
      window.clearTimeout(handle)
    }
  }, [mention])

  function detectMention(value: string, caret: number) {
    const slice = value.slice(0, caret)
    const at = slice.lastIndexOf('@')
    if (at === -1) {
      setMention(null)
      return
    }
    const prevChar = at === 0 ? '\n' : slice[at - 1]
    if (!/\s/.test(prevChar) && at !== 0) {
      setMention(null)
      return
    }
    const query = slice.slice(at + 1)
    if (/\s/.test(query)) {
      setMention(null)
      return
    }
    setMention({ query, start: at })
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    detectMention(e.target.value, e.target.selectionStart)
  }

  function pickMention(p: LinkedPost) {
    if (!mention || !textareaRef.current) return
    const caret = textareaRef.current.selectionStart
    const insertion = `::postlink[${p.slug}]`
    const before = content.slice(0, mention.start)
    const after = content.slice(caret)
    const value = `${before}${insertion}${after}`
    const cursor = before.length + insertion.length
    setContent(value)
    setMention(null)
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor="content"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Body (markdown)
        </label>
        <span className="flex items-center gap-3">
          <button
            type="button"
            onClick={onShowFullPreview}
            className="cursor-pointer font-dm-mono text-xs text-text-tertiary transition-colors hover:text-text-primary"
          >
            Full preview
          </button>
          <span className="font-dm-mono text-xs text-text-tertiary">
            Words: {words} · ~{minutes} min read
          </span>
        </span>
      </div>
      <Toolbar
        applyAction={applyAction}
        onImagePick={onImagePick}
        uploading={uploading}
      />
      <ShortcodePanel />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="relative">
          <textarea
            ref={textareaRef}
            id="content"
            value={content}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setMention(null)
            }}
            rows={24}
            spellCheck
            className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 font-dm-mono text-sm text-text-primary focus:border-brand-ui focus:outline-none"
            placeholder="# Heading&#10;&#10;Your prose goes here. Type @ to mention another post."
          />
          {mention && (mentionResults.length > 0 || mentionLoading) && (
            <ul className="absolute left-3 right-3 top-full z-30 mt-1 max-h-64 overflow-auto rounded-md border border-border-subtle bg-bg-surface shadow-lg">
              {mentionResults.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pickMention(r)}
                    className="flex w-full flex-col px-3 py-2 text-left font-dm-sans text-sm text-text-primary hover:bg-bg-hover"
                  >
                    <span>{r.title}</span>
                    <span className="font-dm-mono text-xs text-text-tertiary">
                      ::postlink[{r.slug}]
                    </span>
                  </button>
                </li>
              ))}
              {mentionLoading && mentionResults.length === 0 && (
                <li className="px-3 py-2 font-dm-mono text-xs text-text-tertiary">
                  Searching...
                </li>
              )}
            </ul>
          )}
        </div>
        <div
          className="journal-prose min-h-[420px] overflow-auto rounded-md border border-border-subtle bg-bg-surface p-4"
          dangerouslySetInnerHTML={{
            __html:
              previewHtml ||
              '<p class="text-text-tertiary">Nothing to preview yet.</p>',
          }}
        />
      </div>
    </div>
  )
}
