'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  importGoodreadsRows,
  matchGoodreadsRows,
  type GoodreadsRow,
} from './actions'

interface PreviewState {
  rows: GoodreadsRow[]
  filename: string
}

interface MatchState {
  matched: number
  unmatched: { title: string; author: string }[]
}

interface ImportResult {
  matched: number
  inserted: number
  unmatched: { title: string; author: string }[]
}

function downloadUnmatched(unmatched: { title: string; author: string }[]) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const csv = [
    'Title,Author',
    ...unmatched.map((u) => `${esc(u.title)},${esc(u.author)}`),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'foxing-unmatched-books.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function GoodreadsImporter() {
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [match, setMatch] = useState<MatchState | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [matching, startMatching] = useTransition()
  const [importing, startImporting] = useTransition()

  async function handleFile(file: File) {
    setError(null)
    setResult(null)
    setMatch(null)
    try {
      const text = await file.text()
      const rows = parseGoodreadsCsv(text)
      if (rows.length === 0) {
        setError('No book rows found in that CSV.')
        return
      }
      setPreview({ rows, filename: file.name })
      // Dry-run match so the review step shows matched vs unmatched first.
      startMatching(() => {
        void matchGoodreadsRows(rows).then((res) => {
          if (!res.ok) {
            setError(res.error)
            return
          }
          setMatch({ matched: res.matched, unmatched: res.unmatched })
        })
      })
    } catch (e) {
      setError(`Could not read CSV: ${(e as Error).message}`)
    }
  }

  function confirm() {
    if (!preview) return
    startImporting(() => {
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
        setMatch(null)
      })
    })
  }

  function reset() {
    setPreview(null)
    setMatch(null)
    setResult(null)
    setError(null)
  }

  if (result) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-5">
        <h2 className="font-fraunces text-lg text-text-primary">
          Import complete
        </h2>
        <p className="font-source-serif-4 text-sm text-text-secondary">
          {result.inserted} book{result.inserted === 1 ? '' : 's'} saved to your
          library.{' '}
          {result.unmatched.length > 0 &&
            `${result.unmatched.length} weren't in the Foxing catalog.`}
        </p>
        {result.unmatched.length > 0 && (
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadUnmatched(result.unmatched)}
            >
              Download unmatched ({result.unmatched.length})
            </Button>
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
          </div>
        )}
        <div className="flex gap-2">
          <Link href="/library">
            <Button variant="primary" size="sm">
              Go to library
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={reset}>
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
          Review · {preview.filename}
        </h2>
        {match ? (
          <p className="font-dm-sans text-sm text-text-secondary">
            {match.matched} of {preview.rows.length} book
            {preview.rows.length === 1 ? '' : 's'} matched the Foxing catalog and
            will be added.{' '}
            {match.unmatched.length > 0 &&
              `${match.unmatched.length} couldn't be matched and will be skipped.`}
          </p>
        ) : (
          <p className="font-dm-sans text-sm text-text-tertiary">
            {matching ? 'Checking matches…' : 'Preparing…'}
          </p>
        )}

        {match && match.unmatched.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadUnmatched(match.unmatched)}
          >
            Download unmatched ({match.unmatched.length})
          </Button>
        )}

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
            disabled={importing || !match || match.matched === 0}
          >
            {importing
              ? 'Importing…'
              : match
                ? `Import ${match.matched} book${match.matched === 1 ? '' : 's'}`
                : 'Import'}
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
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
        stays on your device until you confirm the review step.
      </p>
      {error && <p className="font-dm-sans text-sm text-error">{error}</p>}
    </div>
  )
}

/**
 * Minimal Goodreads CSV parser. Handles quoted fields, escaped quotes ("")
 * inside quoted fields, and commas in quoted fields. Skips empty lines.
 */
function parseGoodreadsCsv(text: string): GoodreadsRow[] {
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
  const col = (name: string) => headers.indexOf(name)
  const idx = {
    title: col('Title'),
    author: col('Author'),
    isbn: col('ISBN'),
    isbn13: col('ISBN13'),
    rating: col('My Rating'),
    review: col('My Review'),
    date_read: col('Date Read'),
    date_added: col('Date Added'),
    shelf: col('Exclusive Shelf'),
  }
  if (idx.title === -1 || idx.author === -1) return []

  const cell = (row: string[], i: number) =>
    i !== -1 ? (row[i] ?? '').trim() : ''

  const out: GoodreadsRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]
    const title = cell(row, idx.title)
    const author = cell(row, idx.author)
    if (!title || !author) continue
    const ratingRaw = cell(row, idx.rating)
    const rating = /^[1-5]$/.test(ratingRaw) ? Number(ratingRaw) : null
    out.push({
      title,
      author,
      isbn: cell(row, idx.isbn) || null,
      isbn13: cell(row, idx.isbn13) || null,
      rating,
      review: cell(row, idx.review) || null,
      date_finished: normalizeDate(cell(row, idx.date_read)),
      date_added: normalizeDate(cell(row, idx.date_added)),
      shelf: cell(row, idx.shelf) || 'to-read',
    })
  }
  return out
}

function normalizeDate(raw: string): string | null {
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
