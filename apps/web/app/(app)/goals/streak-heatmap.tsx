import { cn } from '@/lib/cn'

interface StreakHeatmapProps {
  /** Map of YYYY-MM-DD → number of reading events that day. */
  activity: Record<string, number>
  /** Number of weeks shown, ending today. Defaults to 52. */
  weeks?: number
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * Reading activity heatmap. 52 vertical week columns, each with 7 cells
 * (Sun through Sat). Color intensity scales with the day's event count.
 * Renders on the server so no client JS is required.
 */
export function StreakHeatmap({ activity, weeks = 52 }: StreakHeatmapProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const totalDays = weeks * 7
  const endDay = today.getDay()
  const trailing = 6 - endDay

  const start = new Date(today)
  start.setDate(start.getDate() - (totalDays - 1 - trailing))

  const cells: { date: Date; count: number; key: string }[] = []
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = isoDay(d)
    cells.push({ date: d, count: activity[key] ?? 0, key })
  }

  let maxCount = 1
  for (const c of cells) if (c.count > maxCount) maxCount = c.count

  const columns: { date: Date; count: number; key: string }[][] = []
  for (let w = 0; w < weeks; w++) {
    columns.push(cells.slice(w * 7, w * 7 + 7))
  }

  const monthLabels: { col: number; label: string }[] = []
  let lastLabelledMonth = -1
  columns.forEach((col, i) => {
    const firstDate = col[0].date
    const month = firstDate.getMonth()
    if (month !== lastLabelledMonth && firstDate.getDate() <= 7) {
      monthLabels.push({ col: i, label: MONTH_NAMES[month] })
      lastLabelledMonth = month
    }
  })

  return (
    <div className="flex flex-col gap-1">
      <div
        className="grid grid-flow-col gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {columns.map((col, i) => (
          <div key={i} className="flex flex-col gap-[2px]">
            {col.map((cell) => (
              <span
                key={cell.key}
                aria-label={`${cell.key}, ${cell.count} reading events`}
                title={`${cell.key} · ${cell.count}`}
                className={cn(
                  'aspect-square w-full rounded-[2px]',
                  intensityClass(cell.count, maxCount),
                  cell.date > today && 'opacity-30',
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <div
        className="grid grid-flow-col gap-[2px] font-dm-mono text-[10px] text-text-tertiary"
        style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {columns.map((_, i) => {
          const label = monthLabels.find((m) => m.col === i)
          return (
            <span key={i} className="h-3">
              {label?.label ?? ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function intensityClass(count: number, max: number): string {
  if (count === 0) return 'bg-bg-sunken'
  const ratio = count / max
  if (ratio > 0.75) return 'bg-brand-ui'
  if (ratio > 0.5) return 'bg-brand-hover'
  if (ratio > 0.25) return 'bg-brand-subtle-text'
  return 'bg-brand-subtle'
}
