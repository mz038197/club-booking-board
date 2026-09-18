import { describe, expect, it } from 'vitest'
import { ApiError, formatApiError, parseErrorBody } from './errors.ts'

describe('parseErrorBody', () => {
  it('reads a known 4xx code from the contract body', () => {
    expect(parseErrorBody({ code: 'CONFLICT' })).toBe('CONFLICT')
    expect(parseErrorBody({ code: 'SLOT_TAKEN' })).toBe('SLOT_TAKEN')
    expect(parseErrorBody({ code: 'NOT_OWNER' })).toBe('NOT_OWNER')
    expect(parseErrorBody({ code: 'NOT_FOUND' })).toBe('NOT_FOUND')
    expect(parseErrorBody({ code: 'INVALID_SLOT' })).toBe('INVALID_SLOT')
    expect(parseErrorBody({ code: 'INVALID_POSTER' })).toBe('INVALID_POSTER')
    expect(parseErrorBody({ code: 'INVALID_REQUEST' })).toBe('INVALID_REQUEST')
  })

  it('ignores unknown codes and non-objects', () => {
    expect(parseErrorBody({ code: 'WHOOPS' })).toBeUndefined()
    expect(parseErrorBody(null)).toBeUndefined()
    expect(parseErrorBody('CONFLICT')).toBeUndefined()
  })
})

describe('formatApiError', () => {
  it('surfaces CONFLICT with a teacher-facing explanation', () => {
    const error = new ApiError(409, 'CONFLICT', { code: 'CONFLICT' }, 'API error')
    expect(formatApiError(error)).toContain('CONFLICT')
    expect(formatApiError(error)).toContain('已有預約')
  })

  it('surfaces other contract codes in the message', () => {
    const error = new ApiError(409, 'SLOT_TAKEN', { code: 'SLOT_TAKEN' }, 'API error')
    expect(formatApiError(error)).toContain('SLOT_TAKEN')
  })
})
