import { useEffect, useState } from 'react'
import {
  addReaction,
  castVote,
  fetchDashboard,
  type ChapterReactionRow,
  type ClubDashboardData,
} from '../lib/foxing-api'
import type { DiscordSession } from '../lib/discord-sdk'
import { SprintTimer } from './SprintTimer'

const TABS = ['reading', 'discuss', 'vote', 'sprint'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  reading: "Who's reading",
  discuss: 'Discuss',
  vote: 'Vote',
  sprint: 'Sprint',
}

interface Props {
  clubId: string
  session: DiscordSession
  onBack: () => void
}

const REACTION_EMOJIS = ['😭', '😂', '😱', '😤', '🥺', '🤯', '❤️', '🙃'] as const

export function ClubDashboard({ clubId, session, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('reading')
  const [data, setData] = useState<ClubDashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      const d = await fetchDashboard(session.token, clubId)
      setData(d)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load dashboard.')
    }
  }

  useEffect(() => {
    void refresh()
  }, [clubId])

  return (
    <div className="col">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="ghost" type="button" onClick={onBack}>
          ← Clubs
        </button>
        {data?.current_book && (
          <span className="muted">{data.current_book.title}</span>
        )}
      </div>

      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      {error && <p className="error">{error}</p>}
      {!data ? (
        <p className="muted">Loading...</p>
      ) : tab === 'reading' ? (
        <ReadingTab data={data} />
      ) : tab === 'discuss' ? (
        <DiscussTab
          data={data}
          onAdd={async (emoji, chapter, note) => {
            await addReaction(session.token, clubId, {
              chapter_name: chapter,
              emoji,
              note,
            })
            await refresh()
          }}
        />
      ) : tab === 'vote' ? (
        <VoteTab
          data={data}
          onVote={async (pollId, optionId) => {
            await castVote(session.token, clubId, {
              poll_id: pollId,
              option_id: optionId,
            })
            await refresh()
          }}
        />
      ) : (
        <SprintTimer clubId={clubId} session={session} />
      )}
    </div>
  )
}

function ReadingTab({ data }: { data: ClubDashboardData }) {
  if (data.member_progress.length === 0) {
    return <p className="muted">No member progress yet.</p>
  }
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="col">
      {data.member_progress.map((m) => (
        <li key={m.user_id} className="card row">
          <div className="col" style={{ flex: 1, gap: 4 }}>
            <strong>{m.display_name}</strong>
            <div className="row">
              <div className="progress">
                <span
                  style={{ width: `${Math.max(0, Math.min(100, m.progress_percentage ?? 0))}%` }}
                />
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                {Math.round(m.progress_percentage ?? 0)}%
              </span>
            </div>
          </div>
          {m.status === 'finished' && <span>✓</span>}
        </li>
      ))}
    </ul>
  )
}

function DiscussTab({
  data,
  onAdd,
}: {
  data: ClubDashboardData
  onAdd: (emoji: string, chapter: string, note?: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [chapter, setChapter] = useState('')
  const [emoji, setEmoji] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!emoji || !chapter.trim()) return
    setPending(true)
    await onAdd(emoji, chapter.trim(), note.trim() || undefined)
    setPending(false)
    setChapter('')
    setEmoji(null)
    setNote('')
  }

  const grouped = new Map<string, ChapterReactionRow[]>()
  for (const r of data.chapter_reactions) {
    const arr = grouped.get(r.chapter_name) ?? []
    arr.push(r)
    grouped.set(r.chapter_name, arr)
  }

  return (
    <div className="col">
      {data.discussion_questions.length > 0 && (
        <details className="card">
          <summary>
            Discussion questions ({data.discussion_questions.length})
          </summary>
          <ol className="col" style={{ marginTop: 10 }}>
            {data.discussion_questions.map((q, i) => (
              <li key={i}>{q.question}</li>
            ))}
          </ol>
        </details>
      )}

      {[...grouped.entries()].map(([chapterName, rows]) => {
        const counts = new Map<string, number>()
        for (const r of rows) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1)
        return (
          <div key={chapterName} className="card col">
            <strong>{chapterName}</strong>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {[...counts.entries()].map(([em, n]) => (
                <span key={em} className="muted">
                  {em} × {n}
                </span>
              ))}
            </div>
          </div>
        )
      })}

      <button
        type="button"
        className="ghost"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Cancel' : 'Add a reaction'}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="card col">
          <input
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="Chapter (e.g. Chapter 12)"
          />
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {REACTION_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                className={emoji === em ? '' : 'ghost'}
                onClick={() => setEmoji(em)}
              >
                {em}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
          />
          <button type="submit" disabled={pending || !emoji || !chapter.trim()}>
            Post reaction
          </button>
        </form>
      )}
    </div>
  )
}

function VoteTab({
  data,
  onVote,
}: {
  data: ClubDashboardData
  onVote: (pollId: string, optionId: string) => Promise<void>
}) {
  if (!data.active_poll) {
    return <p className="muted">No active poll right now.</p>
  }
  const poll = data.active_poll
  const total = poll.options.reduce((sum, o) => sum + o.vote_count, 0)
  return (
    <div className="card col">
      <strong>{poll.title}</strong>
      {poll.options.map((opt) => {
        const pct = total > 0 ? Math.round((opt.vote_count / total) * 100) : 0
        const isMine = poll.my_vote === opt.id
        return (
          <div key={opt.id} className="col">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>{opt.label}</span>
              <span className="muted">{opt.vote_count}</span>
            </div>
            <div className="progress">
              <span style={{ width: `${pct}%` }} />
            </div>
            <button
              type="button"
              className={isMine ? '' : 'ghost'}
              onClick={() => onVote(poll.id, opt.id)}
            >
              {isMine ? 'Your vote' : 'Vote'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
