import { describe, expect, it } from 'vitest'
import { createHttpBoardApi } from './client.ts'
import { ApiError } from './errors.ts'
import { createMockBoardApi } from './mockApi.ts'
import type { BoardSlot } from './types.ts'

describe('createHttpBoardApi', () => {
  it('GETs /sessions/{session_id}/board', async () => {
    const payload = {
      slots: [
        {
          slot_id: '2026-09-25_13:00-15:00_301',
          date: '2026-09-25',
          start: '13:00',
          end: '15:00',
          room: '301',
          status: 'open',
        },
      ],
    }
    const fetchImpl: typeof fetch = async (input) => {
      expect(String(input)).toBe('http://api.test/sessions/class-1/board')
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const api = createHttpBoardApi('http://api.test', fetchImpl)
    await expect(api.getBoard('class-1')).resolves.toEqual(payload)
  })

  it('PUTs /sessions/{session_id}/slots with a full replace body', async () => {
    let body = ''
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toBe('http://api.test/sessions/class-1/slots')
      expect(init?.method).toBe('PUT')
      body = String(init?.body)
      return new Response(null, { status: 204 })
    }
    const api = createHttpBoardApi('http://api.test', fetchImpl)
    await api.replaceAvailableSlots('class-1', [
      { date: '2026-09-25', start: '13:00', end: '15:00', room: '301' },
    ])
    expect(JSON.parse(body)).toEqual({
      slots: [{ date: '2026-09-25', start: '13:00', end: '15:00', room: '301' }],
    })
  })

  it('throws ApiError with CONFLICT from a 4xx body', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ code: 'CONFLICT' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    const api = createHttpBoardApi('http://api.test', fetchImpl)
    await expect(
      api.replaceAvailableSlots('class-1', []),
    ).rejects.toMatchObject({ name: 'ApiError', code: 'CONFLICT', status: 409 })
  })
})

describe('createMockBoardApi', () => {
  const booked: BoardSlot = {
    slot_id: '2026-09-25_13:00-15:00_301',
    date: '2026-09-25',
    start: '13:00',
    end: '15:00',
    room: '301',
    status: 'booked',
    booked_by: '第三組',
  }

  it('keeps booked_by when the teacher re-saves an existing booked slot', async () => {
    const api = createMockBoardApi({ s1: [booked] })
    await api.replaceAvailableSlots('s1', [
      { date: '2026-09-25', start: '13:00', end: '15:00', room: '301' },
    ])
    const board = await api.getBoard('s1')
    expect(board.slots[0]?.status).toBe('booked')
    expect(board.slots[0]?.booked_by).toBe('第三組')
  })

  it('returns CONFLICT when replacing would drop a booked slot', async () => {
    const api = createMockBoardApi({ s1: [booked] })
    await expect(api.replaceAvailableSlots('s1', [])).rejects.toBeInstanceOf(ApiError)
    await expect(api.replaceAvailableSlots('s1', [])).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
