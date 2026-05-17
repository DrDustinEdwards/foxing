'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BookCard } from '@/components/book-card'
import { MOODS } from '@/lib/foxing'
import { cn } from '@/lib/cn'

type Pace = 'slow' | 'any' | 'fast'
type Era = 'anytime' | 'pre-1900' | '1900-1950' | 'modern'

interface Recommendation {
  id?: string
  title: string
  author: string
  cover_url?: string | null
  reason: string
}

const PACES: Array<{ id: Pace; label: string }> = [
  { id: 'slow', label: 'Slow' },
  { id: 'any', label: 'Any pace' },
  { id: 'fast', label: 'Fast' },
]

const ERAS: Array<{ id: Era; label: string }> = [
  { id: 'anytime', label: 'Anytime' },
  { id: 'pre-1900', label: 'Pre-1900' },
  { id: '1900-1950', label: '1900 to 1950' },
  { id: 'modern', label: 'Modern' },
]

export function FindNextBookWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [moods, setMoods] = useState<string[]>([])
  const [pace, setPace] = useState<Pace>('any')
  const [era, setEra] = useState<Era>('anytime')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Recommendation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleMood(m: string) {
    setMoods((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    )
  }

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/find-next-book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mood: moods, pace, era }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(
          body?.error === 'subscription_required'
            ? 'This needs Foxing Plus.'
            : 'Something went wrong. Try again.',
        )
        return
      }
      const body = (await res.json()) as {
        recommendations?: Recommendation[]
      } | Recommendation[]
      const list = Array.isArray(body)
        ? body
        : Array.isArray(body?.recommendations)
          ? body.recommendations
          : []
      setResults(list)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (results) {
    return (
      <div className="mt-8 flex flex-col gap-6">
        <h2 className="font-fraunces text-xl text-text-primary">
          Three picks for you
        </h2>
        {results.length === 0 ? (
          <p className="font-source-serif-4 text-base text-text-tertiary">
            No matches. Loosen the filters and try again.
          </p>
        ) : (
          <ul className="flex flex-col gap-5">
            {results.map((r, i) => (
              <li
                key={i}
                className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-bg-surface p-4 md:flex-row"
              >
                <div className="shrink-0">
                  <BookCard
                    book={{
                      id: r.id ?? '',
                      title: r.title,
                      author: r.author,
                      cover_url: r.cover_url ?? null,
                    }}
                    size="md"
                    showRating={false}
                    showMood={false}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="font-source-serif-4 text-base text-text-secondary">
                    {r.reason}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              setResults(null)
              setStep(1)
            }}
          >
            Start over
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <StepIndicator step={step} />

      {step === 1 && (
        <Step heading="What mood are you after?">
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMood(m)}
                className={cn(
                  'rounded-full px-3 py-1.5 font-dm-sans text-sm capitalize',
                  moods.includes(m)
                    ? 'bg-brand-ui text-text-on-brand'
                    : 'bg-bg-sunken text-text-secondary hover:bg-bg-hover',
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              size="md"
              variant="primary"
              onClick={() => setStep(2)}
              disabled={moods.length === 0}
            >
              Next
            </Button>
          </div>
        </Step>
      )}

      {step === 2 && (
        <Step heading="Pace?">
          <div className="flex flex-wrap gap-2">
            {PACES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPace(p.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 font-dm-sans text-sm',
                  pace === p.id
                    ? 'bg-brand-ui text-text-on-brand'
                    : 'bg-bg-sunken text-text-secondary hover:bg-bg-hover',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <Button size="md" variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button size="md" variant="primary" onClick={() => setStep(3)}>
              Next
            </Button>
          </div>
        </Step>
      )}

      {step === 3 && (
        <Step heading="Era?">
          <div className="flex flex-wrap gap-2">
            {ERAS.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEra(e.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 font-dm-sans text-sm',
                  era === e.id
                    ? 'bg-brand-ui text-text-on-brand'
                    : 'bg-bg-sunken text-text-secondary hover:bg-bg-hover',
                )}
              >
                {e.label}
              </button>
            ))}
          </div>
          {error && (
            <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}
          <div className="flex justify-between">
            <Button size="md" variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              size="md"
              variant="primary"
              onClick={submit}
              loading={loading}
            >
              Find books
            </Button>
          </div>
        </Step>
      )}
    </div>
  )
}

function Step({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-bg-surface p-5">
      <h2 className="font-fraunces text-lg text-text-primary">{heading}</h2>
      {children}
    </section>
  )
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="flex gap-2 font-dm-mono text-xs text-text-tertiary">
      {[1, 2, 3].map((n) => (
        <li
          key={n}
          className={cn(
            'rounded-full px-2 py-0.5',
            step === n
              ? 'bg-brand-subtle text-brand-subtle-text'
              : 'bg-bg-sunken',
          )}
        >
          {n} / 3
        </li>
      ))}
    </ol>
  )
}
