import { AddScheduleForm } from './add-schedule-form'
import { ScheduleDeleteButton } from './schedule-delete-button'

export interface ScheduleEntry {
  id: string
  chapter_name: string
  unlock_date: string
}

interface Props {
  clubId: string
  entries: ScheduleEntry[]
  canManage: boolean
}

function statusFor(unlock: Date, now: Date): {
  label: string
  chip: 'upcoming' | 'today' | 'unlocked'
} {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 1)
  if (unlock < now && unlock < start) {
    return { label: 'Unlocked', chip: 'unlocked' }
  }
  if (unlock >= start && unlock < end) {
    return { label: 'Today', chip: 'today' }
  }
  return { label: 'Upcoming', chip: 'upcoming' }
}

function formatUnlock(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const CHIP_CLASS: Record<'upcoming' | 'today' | 'unlocked', string> = {
  upcoming: 'bg-bg-sunken text-text-secondary',
  today: 'bg-brand-subtle text-brand-subtle-text',
  unlocked: 'bg-success-bg text-success',
}

export function ScheduleSection({ clubId, entries, canManage }: Props) {
  const now = new Date()
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        Reading schedule
      </h2>
      {entries.length === 0 ? (
        <p className="font-source-serif-4 text-sm text-text-tertiary">
          {canManage
            ? 'Set a reading schedule to automatically unlock chapters.'
            : 'No reading schedule set.'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
          {entries.map((e) => {
            const unlock = new Date(e.unlock_date)
            const status = statusFor(unlock, now)
            return (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex flex-col leading-tight">
                  <span className="font-fraunces text-sm text-text-primary">
                    {e.chapter_name}
                  </span>
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    {status.chip === 'unlocked' ? 'Unlocked' : 'Unlocks'}{' '}
                    {formatUnlock(e.unlock_date)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-md px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-wider ${CHIP_CLASS[status.chip]}`}
                  >
                    {status.label}
                  </span>
                  {canManage && (
                    <ScheduleDeleteButton
                      scheduleId={e.id}
                      clubId={clubId}
                    />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {canManage && (
        <div className="mt-4">
          <AddScheduleForm clubId={clubId} />
        </div>
      )}
    </section>
  )
}
