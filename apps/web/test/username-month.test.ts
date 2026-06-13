import { describe, expect, it } from 'vitest'
import { validateUsernameFormat } from '@/lib/username'
import {
  parseYearMonth,
  previousMonth,
  nextMonth,
  formatYearMonth,
} from '@/lib/month'

describe('validateUsernameFormat', () => {
  it('accepts normal usernames', () => {
    expect(validateUsernameFormat('dustin').ok).toBe(true)
    expect(validateUsernameFormat('jane_austen-2').ok).toBe(true)
  })

  it('rejects too short and too long', () => {
    expect(validateUsernameFormat('ab').ok).toBe(false)
    expect(validateUsernameFormat('a'.repeat(31)).ok).toBe(false)
  })

  it('rejects uppercase, spaces, and edge separators', () => {
    expect(validateUsernameFormat('Dustin').ok).toBe(false)
    expect(validateUsernameFormat('two words').ok).toBe(false)
    expect(validateUsernameFormat('-leading').ok).toBe(false)
    expect(validateUsernameFormat('trailing_').ok).toBe(false)
  })
})

describe('month helpers', () => {
  it('parseYearMonth bounds-checks year and month', () => {
    expect(parseYearMonth('2026', '6')).toEqual({ year: 2026, month: 6 })
    expect(parseYearMonth('1899', '6')).toBeNull()
    expect(parseYearMonth('2026', '13')).toBeNull()
    expect(parseYearMonth('2026', '0')).toBeNull()
    expect(parseYearMonth('20.5', '6')).toBeNull()
    expect(parseYearMonth('abc', '6')).toBeNull()
  })

  it('previous/next month wrap across year boundaries', () => {
    expect(previousMonth(2026, 1)).toEqual({ year: 2025, month: 12 })
    expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 })
    expect(previousMonth(2026, 6)).toEqual({ year: 2026, month: 5 })
  })

  it('formatYearMonth zero-pads', () => {
    expect(formatYearMonth(2026, 6)).toBe('2026-06')
    expect(formatYearMonth(2026, 11)).toBe('2026-11')
  })
})
