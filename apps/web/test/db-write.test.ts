import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PostgrestError } from '@supabase/supabase-js'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { reportWriteError } from '@/lib/db-write'

// Regression for the Pass 2 silent-write retrofit: supabase-js returns
// { error } instead of throwing, so failed writes must reach Sentry.
describe('reportWriteError', () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockClear()
  })

  it('is a no-op on the happy path', () => {
    expect(reportWriteError(null, { op: 'insert', table: 'books' })).toBe(false)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('reports the error with op and table tags and returns true', () => {
    const error = {
      message: 'permission denied',
      code: '42501',
      details: '',
      hint: '',
      name: 'PostgrestError',
    } as PostgrestError
    expect(reportWriteError(error, { op: 'insert', table: 'books' })).toBe(true)
    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({
          area: 'db-write',
          op: 'insert',
          table: 'books',
        }),
      }),
    )
  })
})
