export interface MonthPeriod {
  year: number
  month: number
  startISO: string
  endISO: string
  label: string
}

export interface WeekPeriod {
  year: number
  week: number
  startISO: string
  endISO: string
  label: string
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function currentMonthPeriod(now: Date = new Date()): MonthPeriod {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return {
    year,
    month,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    label: `${MONTH_NAMES[month - 1]} ${year}`,
  }
}

export function isoWeekOf(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  )
  return { year: d.getUTCFullYear(), week }
}

export function currentWeekPeriod(now: Date = new Date()): WeekPeriod {
  const { year, week } = isoWeekOf(now)
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const dow = simple.getUTCDay()
  const start = new Date(simple)
  if (dow <= 4) start.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1)
  else start.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay())
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 7)
  return {
    year,
    week,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    label: `Week ${week}, ${year}`,
  }
}
