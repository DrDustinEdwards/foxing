import { useEffect, useState } from 'react'
import { authenticate, type DiscordSession } from './lib/discord-sdk'
import { fetchClubs, type ClubSummary } from './lib/foxing-api'
import { ClubSelector } from './screens/ClubSelector'
import { ClubDashboard } from './screens/ClubDashboard'

type Stage =
  | { kind: 'loading' }
  | { kind: 'needs_link'; authUrl: string }
  | { kind: 'ready'; session: DiscordSession; clubs: ClubSummary[] }
  | { kind: 'error'; message: string }

export function App() {
  const [stage, setStage] = useState<Stage>({ kind: 'loading' })
  const [activeClubId, setActiveClubId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const session = await authenticate()
        if (cancelled) return
        if (!session) {
          setStage({
            kind: 'needs_link',
            authUrl: 'https://foxing.app/settings#discord',
          })
          return
        }
        const clubs = await fetchClubs(session.token)
        if (cancelled) return
        setStage({ kind: 'ready', session, clubs })
      } catch (err) {
        if (cancelled) return
        setStage({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to start.',
        })
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  if (stage.kind === 'loading') {
    return (
      <div className="app">
        <p className="muted">Connecting to Discord...</p>
      </div>
    )
  }

  if (stage.kind === 'needs_link') {
    return (
      <div className="app">
        <h1>Connect your Foxing account</h1>
        <p className="muted">
          Open Foxing in a browser and link your Discord account to use this
          Activity.
        </p>
        <a href={stage.authUrl} target="_blank" rel="noopener noreferrer">
          <button type="button">Open Foxing</button>
        </a>
      </div>
    )
  }

  if (stage.kind === 'error') {
    return (
      <div className="app">
        <p className="error">{stage.message}</p>
      </div>
    )
  }

  if (!activeClubId) {
    return (
      <div className="app">
        <ClubSelector
          clubs={stage.clubs}
          onPick={(id) => setActiveClubId(id)}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <ClubDashboard
        clubId={activeClubId}
        session={stage.session}
        onBack={() => setActiveClubId(null)}
      />
    </div>
  )
}
