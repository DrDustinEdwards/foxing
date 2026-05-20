'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BookSearchAdd } from '@/components/book-search-add'
import { addCommonplaceEntry } from '@/app/(app)/commonplace/actions'

interface SelectedBook {
  id: string
  title: string
  author: string
}

interface Props {
  open: boolean
  onClose: () => void
  initialBook?: SelectedBook
}

const MAX_DIM = 1024

async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85)
  })
}

export function PhotoQuoteModal({ open, onClose, initialBook }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [text, setText] = useState('')
  const [book, setBook] = useState<SelectedBook | null>(initialBook ?? null)
  const [bookTitle, setBookTitle] = useState('')
  const [note, setNote] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setPreview(null)
    setFile(null)
    setText('')
    setBookTitle('')
    setNote('')
    setIsPublic(false)
    setError(null)
    setBook(initialBook ?? null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError(null)
  }

  async function handleExtract() {
    if (!file) return
    setError(null)
    setExtracting(true)
    try {
      const resized = await resizeImage(file)
      const fd = new FormData()
      fd.set('image', resized, 'page.jpg')
      const res = await fetch('/api/ai/extract-quote', {
        method: 'POST',
        body: fd,
      })
      const data = (await res.json()) as { text?: string; error?: string }
      if (!res.ok || data.error) {
        setError(data.error === 'not_configured'
          ? 'AI extraction is not available right now.'
          : 'Could not extract text.')
        return
      }
      const extracted = (data.text ?? '').trim()
      if (!extracted) {
        setError('No readable text found. Try a clearer photo.')
        return
      }
      setText(extracted)
    } catch {
      setError('Could not extract text.')
    } finally {
      setExtracting(false)
    }
  }

  async function handleSave() {
    if (!text.trim()) {
      setError('Add the passage text.')
      return
    }
    setSaving(true)
    setError(null)
    const fd = new FormData()
    fd.set('passage_text', text)
    if (book) {
      fd.set('book_id', book.id)
      fd.set('book_title', book.title)
    } else if (bookTitle.trim()) {
      fd.set('book_title', bookTitle.trim())
    }
    if (note.trim()) fd.set('note', note.trim())
    if (isPublic) fd.set('is_public', 'on')
    const res = await addCommonplaceEntry(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    handleClose()
    router.refresh()
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Capture passage from photo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-fraunces text-xl text-text-primary">
            Capture a passage
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded-md p-1 text-text-tertiary hover:bg-bg-hover"
          >
            <CloseIcon />
          </button>
        </div>

        {!preview ? (
          <div className="flex flex-col gap-3">
            <p className="font-source-serif-4 text-sm text-text-secondary">
              Snap a photo of a page. We will extract the text for you.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="block font-dm-sans text-sm text-text-primary"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-md border border-border-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Page preview"
                className="max-h-64 w-full object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleExtract}
                loading={extracting}
                disabled={!file}
              >
                Extract text
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  reset()
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                Retake
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="passage-text"
            className="font-dm-sans text-sm text-text-secondary"
          >
            Passage
          </label>
          <textarea
            id="passage-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={5000}
            placeholder="Extracted text will appear here. You can edit before saving."
            className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-base text-text-primary"
          />
        </div>

        {!initialBook && (
          <div className="flex flex-col gap-2">
            <p className="font-dm-sans text-sm text-text-secondary">
              From which book?
            </p>
            {book ? (
              <div className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-sunken p-2">
                <div className="flex flex-col">
                  <p className="font-fraunces text-sm text-text-primary">
                    {book.title}
                  </p>
                  <p className="font-dm-sans text-xs text-text-tertiary">
                    {book.author}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBook(null)}
                  className="font-dm-mono text-xs text-text-tertiary hover:text-error"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <BookSearchAdd
                  onSelect={(b) =>
                    setBook({ id: b.id, title: b.title, author: b.author })
                  }
                  placeholder="Search by title or author"
                />
                <Input
                  label="Or type a book title"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="If the book is not in our catalog"
                />
              </>
            )}
          </div>
        )}

        <Input
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why does this passage matter?"
        />

        <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Make this passage public
        </label>

        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
