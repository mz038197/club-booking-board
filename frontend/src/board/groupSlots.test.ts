import { describe, expect, it } from 'vitest'
import type { BoardSlot } from '../api/types.ts'
import { buildBoardGrid, cellKey } from './groupSlots.ts'

const slots: BoardSlot[] = [
  {
    slot_id: '2026-09-25_13:00-15:00_301',
    date: '2026-09-25',
    start: '13:00',
    end: '15:00',
    room: '301',
    status: 'open',
  },
  {
    slot_id: '2026-09-25_13:00-15:00_302',
    date: '2026-09-25',
    start: '13:00',
    end: '15:00',
    room: '302',
    status: 'booked',
    booked_by: 'agent-a',
  },
  {
    slot_id: '2026-09-26_09:00-11:00_301',
    date: '2026-09-26',
    start: '09:00',
    end: '11:00',
    room: '301',
    status: 'open',
  },
]

describe('buildBoardGrid', () => {
  it('groups slots by date, time band, and room', () => {
    const grid = buildBoardGrid(slots)
    expect(grid.dates).toEqual(['2026-09-25', '2026-09-26'])
    expect(grid.rooms).toEqual(['301', '302'])
    expect(grid.bands).toEqual([
      { start: '09:00', end: '11:00' },
      { start: '13:00', end: '15:00' },
    ])
    expect(grid.lookup.get(cellKey('2026-09-25', { start: '13:00', end: '15:00' }, '302'))?.booked_by).toBe(
      'agent-a',
    )
  })
})
