'use client'

import { type ChangeEvent, type ReactNode, useState } from 'react'
import {
  type SelectionState,
  extractYouTubeId,
  insertBlock,
  prefixLines,
  wrapSelection,
} from '../editor-actions'

export function Toolbar({
  applyAction,
  onImagePick,
  uploading,
}: {
  applyAction: (fn: (s: SelectionState) => SelectionState) => void
  onImagePick: (e: ChangeEvent<HTMLInputElement>) => void
  uploading: boolean
}) {
  const [calloutOpen, setCalloutOpen] = useState(false)

  function callout(kind: 'tip' | 'warning' | 'note' | 'danger') {
    setCalloutOpen(false)
    applyAction((s) =>
      insertBlock(s, `:::${kind}\nBody text.\n:::`, `:::${kind}\n`.length),
    )
  }

  function pullQuote() {
    applyAction((s) =>
      insertBlock(s, `:::pullquote\nQuote text.\n:::`, ':::pullquote\n'.length),
    )
  }

  function toggle() {
    applyAction((s) =>
      insertBlock(
        s,
        `:::toggle Title\nBody.\n:::`,
        ':::toggle '.length,
      ),
    )
  }

  function bookmark() {
    const url = window.prompt('Bookmark URL')
    if (!url) return
    applyAction((s) =>
      insertBlock(s, `::bookmark[${url}]`, `::bookmark[`.length + url.length),
    )
  }

  function youtube() {
    const raw = window.prompt('YouTube URL or video ID')
    if (!raw) return
    const id = extractYouTubeId(raw)
    if (!id) {
      window.alert('Could not parse a YouTube id from that input.')
      return
    }
    applyAction((s) =>
      insertBlock(s, `::youtube[${id}]`, `::youtube[`.length + id.length),
    )
  }

  function link() {
    const href = window.prompt('Link URL') ?? ''
    if (!href) return
    applyAction((s) => wrapSelection(s, '[', `](${href})`, 'link text'))
  }

  function table() {
    const block = [
      '| Column A | Column B |',
      '| --- | --- |',
      '| Cell 1 | Cell 2 |',
      '| Cell 3 | Cell 4 |',
    ].join('\n')
    applyAction((s) => insertBlock(s, block, block.length))
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-border-subtle bg-bg-surface p-1.5">
      <TBtn
        label="H2"
        onClick={() =>
          applyAction((s) => prefixLines(s, '## '))
        }
      />
      <TBtn
        label="H3"
        onClick={() => applyAction((s) => prefixLines(s, '### '))}
      />
      <TSep />
      <TBtn
        label="B"
        title="Bold"
        bold
        onClick={() =>
          applyAction((s) => wrapSelection(s, '**', '**', 'bold text'))
        }
      />
      <TBtn
        label="I"
        title="Italic"
        italic
        onClick={() =>
          applyAction((s) => wrapSelection(s, '*', '*', 'italic text'))
        }
      />
      <TBtn label="Link" title="Link" onClick={link} />
      <TBtn
        label="Code"
        title="Inline code"
        onClick={() =>
          applyAction((s) => wrapSelection(s, '`', '`', 'code'))
        }
      />
      <TBtn
        label="```"
        title="Code block"
        onClick={() =>
          applyAction((s) =>
            insertBlock(s, '```\ncode\n```', '```\n'.length),
          )
        }
      />
      <TBtn
        label="Quote"
        onClick={() => applyAction((s) => prefixLines(s, '> '))}
      />
      <TSep />
      <div className="relative">
        <button
          type="button"
          onClick={() => setCalloutOpen((v) => !v)}
          className="rounded px-2 py-1 font-dm-sans text-xs text-text-primary hover:bg-bg-hover"
        >
          Callout ▾
        </button>
        {calloutOpen && (
          <ul className="absolute left-0 top-full z-20 mt-1 min-w-[10rem] rounded-md border border-border-subtle bg-bg-surface shadow-lg">
            {(['tip', 'warning', 'note', 'danger'] as const).map((k) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => callout(k)}
                  className="block w-full px-3 py-1.5 text-left font-dm-sans text-sm text-text-primary hover:bg-bg-hover"
                >
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <TBtn label="Pull quote" onClick={pullQuote} />
      <TBtn label="Toggle" onClick={toggle} />
      <TSep />
      <label className="cursor-pointer rounded px-2 py-1 font-dm-sans text-xs text-text-primary hover:bg-bg-hover">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onImagePick}
        />
        {uploading ? 'Uploading...' : 'Image'}
      </label>
      <TBtn label="YouTube" onClick={youtube} />
      <TBtn label="Bookmark" onClick={bookmark} />
      <TSep />
      <TBtn label="Table" onClick={table} />
      <TBtn
        label="---"
        title="Horizontal rule"
        onClick={() => applyAction((s) => insertBlock(s, '---', 3))}
      />
    </div>
  )
}

function TBtn({
  label,
  title,
  bold,
  italic,
  onClick,
}: {
  label: ReactNode
  title?: string
  bold?: boolean
  italic?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded px-2 py-1 font-dm-sans text-xs text-text-primary hover:bg-bg-hover ${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''}`}
    >
      {label}
    </button>
  )
}

function TSep() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 inline-block h-4 w-px bg-border-subtle"
    />
  )
}
