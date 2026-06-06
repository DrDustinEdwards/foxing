export function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' })
}

export function pickMonthLabel(year: number, month: number): string {
  return `${monthName(month)} ${year}`
}

export function previousMonth(
  year: number,
  month: number,
): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

export function nextMonth(
  year: number,
  month: number,
): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

export function parseYearMonth(
  year: string,
  month: string,
): { year: number; month: number } | null {
  const y = Number(year)
  const m = Number(month)
  if (
    !Number.isInteger(y) ||
    !Number.isInteger(m) ||
    y < 1900 ||
    y > 3000 ||
    m < 1 ||
    m > 12
  ) {
    return null
  }
  return { year: y, month: m }
}

export function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}
