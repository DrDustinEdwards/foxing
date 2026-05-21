'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { importGoodreadsRows } from './actions'

interface ParsedRow {
  title: string
  author: string
  rating: number | null
  review: string | null
  date_finished: string | null
  shelf: string
}

interface PreviewState {
  rows: ParsedRow[]
  filename: string
}

interface ImportResult {
  matched: number
  inserted: number
  unmatched: { title: string; author: string }[]
}

export function GoodreadsImporter() {
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function handleFile(file: File) {
    setError(null)
    setResult(null)
    try {
      const text = await file.text()
      const rows = parseGoodreadsCsv(text)
      if (rows.length === 0) {
        setError('No book rows found in that CSV.')
        return
      }
      setPreview({ rows, filename: file.name })
    } catch (e) {
      setError(`Could not read CSV: ${(e as Error).message}`)
    }
  }

  function confirm() {
    if (!preview) return
    startTransition(() => {
      void importGoodreadsRows(preview.rows).then((res) => {
        if (!res.ok) {
          setError(res.error)
          return
        }
        setResult({
          matched: res.matched,
          inserted: res.inserted,
          unmatched: res.unmatched,
        })
        setPreview(null)
      })
    })
  }

  if (result) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-5">
        <h2 className="font-fraunces text-lg text-text-primary">Import complete</h2>
        <p className="font-source-serif-4 text-sm text-text-secondary">
          {result.inserted} books added to your library.{' '}
          {result.matched - result.inserted > 0 &&
            `${result.matched - result.inserted} were already on your shelves. `}
          {result.unmatched.length > 0 &&
            `${result.unmatched.length} weren't in the Foxing catalog.`}
        </p>
        {result.unmatched.length > 0 && (
          <details className="rounded border border-border-subtle bg-bg-base p-3">
            <summary className="cursor-pointer font-dm-sans text-sm text-text-secondary">
              Unmatched titles
            </summary>
            <ul className="mt-2 max-h-60 overflow-auto font-dm-mono text-xs text-text-tertiary">
              {result.unmatched.map((u, i) => (
                <li key={i}>
                  {u.title} · {u.author}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="flex gap-2">
          <Link href="/library">
            <Button variant="primary" size="sm">
              Go to library
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setResult(null)}
          >
            Import another file
          </Button>
        </div>
      </div>
    )
  }

  if (preview) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-5">
        <h2 className="font-fraunces text-lg text-text-primary">
          Preview · {preview.filename}
        </h2>
        <p className="font-dm-sans text-sm text-text-tertiary">
          {preview.rows.length} rows found. Foxing will match each book by
          title + author and add it to the matching shelf.
        </p>
        <div className="max-h-72 overflow-auto rounded border border-border-subtle bg-bg-base">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border-subtle bg-bg-surface font-dm-mono uppercase tracking-wide text-text-tertiary">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Author</th>
                <th className="px-3 py-2">Shelf</th>
                <th className="px-3 py-2">Rating</th>
              </tr>
            </thead>
            <tbody className="font-dm-sans">
              {preview.rows.slice(0, 30).map((r, i) => (
                <tr key={i} className="border-b border-border-subtle">
                  <td className="px-3 py-1.5 text-text-primary">{r.title}</td>
                  <td className="px-3 py-1.5 text-text-secondary">{r.author}</td>
                  <td className="px-3 py-1.5 text-text-tertiary">{r.shelf}</td>
                  <td className="px-3 py-1.5 text-text-tertiary">
                    {r.rating ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={confirm}
            disabled={pending}
          >
            {pending ? 'Importing' : `Import ${preview.rows.length} books`}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreview(null)}
          >
            Cancel
          </Button>
        </div>
        {error && <p className="font-dm-sans text-sm text-error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-5">
      <label className="flex flex-col gap-2">
        <span className="font-dm-sans text-sm text-text-secondary">
          Upload your Goodreads export CSV
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
          }}
          className="font-dm-sans text-sm text-text-primary"
        />
      </label>
      <p className="font-dm-sans text-xs text-text-tertiary">
        Goodreads → My Books → Import and Export → Export Library. Your data
        stays on your device until you confirm the preview below.
      </p>
      {error && <p className="font-dm-sans text-sm text-error">{error}</p>}
    </div>
  )
}

/**
 * Minimal Goodreads CSV parser. Handles quoted fields, escaped quotes ("")
 * inside quoted fields, and commas in quoted fields. Skips empty lines.
 */
function parseGoodreadsCsv(text: string): ParsedRow[] {
  const lines: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        current.push(field)
        field = ''
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        current.push(field)
        if (current.some((c) => c.length > 0)) lines.push(current)
        current = []
        field = ''
      } else {
        field += ch
      }
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field)
    if (current.some((c) => c.length > 0)) lines.push(current)
  }

  if (lines.length === 0) return []
  const headers = lines[0].map((h) => h.trim())
  const idx = {
    title: headers.indexOf('Title'),
    author: headers.indexOf('Author'),
    rating: headers.indexOf('My Rating'),
    review: headers.indexOf('My Review'),
    date_read: headers.indexOf('Date Read'),
    shelf: headers.indexOf('Exclusive Shelf'),
  }
  if (idx.title === -1 || idx.author === -1) return []

  const out: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]
    const title = (row[idx.title] ?? '').trim()
    const author = (row[idx.author] ?? '').trim()
    if (!title || !author) continue
    const ratingRaw = idx.rating !== -1 ? row[idx.rating]?.trim() : ''
    const rating = ratingRaw && /^[1-5]$/.test(ratingRaw) ? Number(ratingRaw) : null
    const review = idx.review !== -1 ? row[idx.review]?.trim() || null : null
    const dateRaw = idx.date_read !== -1 ? row[idx.date_read]?.trim() : ''
    const dateFinished = dateRaw ? normalizeDate(dateRaw) : null
    const shelf = idx.shelf !== -1 ? row[idx.shelf]?.trim() || 'to-read' : 'to-read'
    out.push({
      title,
      author,
      rating,
      review,
      date_finished: dateFinished,
      shelf,
    })
  }
  return out
}

function normalizeDate(raw: string): string | null {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
