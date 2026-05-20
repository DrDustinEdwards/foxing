'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addBookToLibrary } from '@/app/(app)/library/actions'

type ScanState = 'idle' | 'scanning' | 'found' | 'not_found' | 'error'

interface BookHit {
  id: string
  slug: string | null
  title: string
  author: string
  cover_url: string | null
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
}

interface BarcodeDetectorCtor {
  new (options: { formats: string[] }): BarcodeDetectorLike
}

interface Props {
  open: boolean
  onClose: () => void
}

const VALID_STATUSES = [
  { value: 'want_to_read', label: 'Want to read' },
  { value: 'reading', label: 'Reading' },
  { value: 'finished', label: 'Finished' },
] as const

type Status = (typeof VALID_STATUSES)[number]['value']

export function BarcodeScannerModal({ open, onClose }: Props) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [supported, setSupported] = useState(false)
  const [state, setState] = useState<ScanState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [manualIsbn, setManualIsbn] = useState('')
  const [book, setBook] = useState<BookHit | null>(null)
  const [status, setStatus] = useState<Status>('want_to_read')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector
    setSupported(typeof ctor === 'function')
  }, [])

  useEffect(() => {
    if (!open) {
      stopCamera()
      setState('idle')
      setBook(null)
      setManualIsbn('')
      setError(null)
    }
  }, [open])

  function stopCamera() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop()
      streamRef.current = null
    }
  }

  async function startScanning() {
    setError(null)
    setState('scanning')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
        .BarcodeDetector
      if (!ctor) {
        setState('error')
        setError('Barcode detection not supported in this browser.')
        return
      }
      const detector = new ctor({ formats: ['ean_13', 'ean_8', 'isbn'] })
      pollRef.current = setInterval(async () => {
        if (!videoRef.current) return
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const raw = barcodes[0].rawValue
            stopCamera()
            await lookupIsbn(raw)
          }
        } catch {
          // detect can throw intermittently before stream is ready
        }
      }, 500)
    } catch (err) {
      setState('error')
      setError(
        err instanceof Error
          ? err.message
          : 'Could not access camera.',
      )
    }
  }

  async function lookupIsbn(isbn: string) {
    const clean = isbn.replace(/[^0-9Xx]/g, '')
    if (clean.length !== 10 && clean.length !== 13) {
      setState('error')
      setError('Invalid ISBN.')
      return
    }
    try {
      const res = await fetch(`/api/books/lookup?isbn=${clean}`)
      const data = (await res.json()) as
        | { found: true; book: BookHit }
        | { found: false; external?: { title: string; author: string } }
      if (data.found) {
        setBook(data.book)
        setState('found')
      } else {
        setState('not_found')
      }
    } catch {
      setState('error')
      setError('Lookup failed.')
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manualIsbn.trim()) return
    setError(null)
    await lookupIsbn(manualIsbn)
  }

  async function handleAdd() {
    if (!book) return
    setSaving(true)
    const fd = new FormData()
    fd.set('book_id', book.id)
    fd.set('status', status)
    const res = await addBookToLibrary(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onClose()
    router.refresh()
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan book barcode"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-fraunces text-xl text-text-primary">
            Add by barcode
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-text-tertiary hover:bg-bg-hover"
          >
            <CloseIcon />
          </button>
        </div>

        {state === 'idle' && (
          <div className="mt-4 flex flex-col gap-4">
            {supported ? (
              <Button variant="primary" onClick={startScanning}>
                Start camera
              </Button>
            ) : (
              <p className="font-source-serif-4 text-sm text-text-tertiary">
                Camera scanning is not supported in this browser. Enter the
                ISBN below.
              </p>
            )}
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-2">
              <Input
                label="ISBN"
                value={manualIsbn}
                onChange={(e) => setManualIsbn(e.target.value)}
                placeholder="9780000000000"
                inputMode="numeric"
              />
              <Button type="submit" variant="secondary">
                Look up
              </Button>
            </form>
          </div>
        )}

        {state === 'scanning' && (
          <div className="mt-4 flex flex-col gap-3">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-video w-full rounded-md bg-bg-sunken object-cover"
            />
            <p className="font-source-serif-4 text-sm text-text-tertiary">
              Point your camera at the barcode on the back of the book.
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                stopCamera()
                setState('idle')
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        {state === 'found' && book && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex gap-3">
              <div className="relative h-32 w-20 shrink-0 overflow-hidden rounded bg-bg-sunken">
                {book.cover_url && (
                  <Image
                    src={book.cover_url}
                    alt={book.title}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex flex-col">
                <p className="font-fraunces text-base text-text-primary">
                  {book.title}
                </p>
                <p className="font-dm-sans text-sm text-text-tertiary">
                  {book.author}
                </p>
              </div>
            </div>
            <label className="flex flex-col gap-1 font-dm-sans text-sm text-text-secondary">
              Shelf
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="rounded-md border border-border-interactive bg-bg-surface px-2 py-1.5 text-text-primary"
              >
                {VALID_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleAdd} loading={saving}>
                Add to library
              </Button>
              <Link href={`/book/${book.slug ?? book.id}`}>
                <Button variant="ghost">View book</Button>
              </Link>
            </div>
          </div>
        )}

        {state === 'not_found' && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="font-source-serif-4 text-sm text-text-primary">
              Book not found in catalog. Try searching by title.
            </p>
            <div className="flex gap-2">
              <Link href="/books">
                <Button variant="primary">Search books</Button>
              </Link>
              <Button variant="ghost" onClick={() => setState('idle')}>
                Try again
              </Button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
              {error ?? 'Something went wrong.'}
            </p>
            <Button variant="ghost" onClick={() => setState('idle')}>
              Try again
            </Button>
          </div>
        )}
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
