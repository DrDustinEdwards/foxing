import type { ClubSummary } from '../lib/foxing-api'

interface Props {
  clubs: ClubSummary[]
  onPick: (clubId: string) => void
}

export function ClubSelector({ clubs, onPick }: Props) {
  return (
    <div className="col">
      <h1 style={{ fontFamily: 'serif', margin: 0 }}>Pick a club</h1>
      <p className="muted">
        Reading clubs you belong to on Foxing.
      </p>
      {clubs.length === 0 ? (
        <p className="muted">
          You are not in any clubs yet. Join one on foxing.app/clubs.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="col">
          {clubs.map((c) => (
            <li key={c.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="col" style={{ gap: 4 }}>
                  <strong>{c.name}</strong>
                  {c.current_book && (
                    <span className="muted">
                      Reading {c.current_book.title}
                    </span>
                  )}
                  <span className="muted">
                    {c.member_count ?? 0} members
                  </span>
                </div>
                <button type="button" onClick={() => onPick(c.id)}>
                  Open
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
