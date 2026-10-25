import { useEffect, useState } from 'react'
import {
  fetchSprint,
  logSprint,
  startSprint,
  type SprintStatus,
} from '../lib/foxing-api'
import type { DiscordSession } from '../lib/discord-sdk'

interface Props {
  clubId: string
  session: DiscordSession
}

const DURATIONS = [10, 20, 30] as const

export function SprintTimer({ clubId, session }: Props) {
  const [sprint, setSprint] = useState<SprintStatus | null>(null)
  const [now, setNow] = useState(Date.now())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logged, setLogged] = useState(false)
  const [pages, setPages] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let canceled = false
    if (!sprint) return
    const interval = setInterval(async () => {
      try {
        const next = await fetchSprint(session.token, sprint.id)
        if (!canceled) setSprint(next)
      } catch {
        // network blips are non-fatal
      }
    }, 10000)
    return () => {
      canceled = true
      clearInterval(interval)
    }
  }, [sprint?.id])

  async function handleStart(minutes: number) {
    setError(null)
    setPending(true)
    try {
      const { sprint: s } = await startSprint(session.token, {
        club_id: clubId,
        duration_minutes: minutes,
      })
      setSprint(s)
      setLogged(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start sprint.')
    } finally {
      setPending(false)
    }
  }

  async function handleLog(e: React.FormEvent) {
    e.preventDefault()
    if (!sprint) return
    const n = Number(pages)
    if (!Number.isFinite(n) || n < 0) {
      setError('Enter a number of pages.')
      return
    }
    setPending(true)
    try {
      await logSprint(session.token, sprint.id, n)
      setLogged(true)
      const next = await fetchSprint(session.token, sprint.id)
      setSprint(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log pages.')
    } finally {
      setPending(false)
    }
  }

  if (!sprint) {
    return (
      <div className="col">
        <p className="muted">Pick a sprint length. Everyone reads together.</p>
        <div className="row">
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => void handleStart(m)}
              disabled={pending}
            >
              {m} min
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  const endsAt = new Date(sprint.ends_at).getTime()
  const remainingMs = Math.max(0, endsAt - now)
  const mm = Math.floor(remainingMs / 60000)
  const ss = Math.floor((remainingMs % 60000) / 1000)
  const done = remainingMs === 0

  return (
    <div className="col card">
      <strong>{done ? 'Sprint complete' : 'Sprint in progress'}</strong>
      <p style={{ fontSize: 32, margin: 0 }}>
        {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
      </p>
      <p className="muted">
        {sprint.participant_count} readers · {sprint.pages_logged} pages logged
      </p>
      {done && !logged && (
        <form onSubmit={handleLog} className="col">
          <input
            inputMode="numeric"
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            placeholder="Pages you read"
          />
          <button type="submit" disabled={pending}>
            Log pages
          </button>
        </form>
      )}
      {done && logged && (
        <p className="muted">
          Group read {sprint.pages_logged} pages in this sprint.
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
