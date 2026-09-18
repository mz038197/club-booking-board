import { describe, expect, it } from 'vitest'
import { formatSlotId, parseSlotId } from './slotId.ts'

describe('slot_id', () => {
  it('formats {date}_{start}-{end}_{room}', () => {
    expect(
      formatSlotId({
        date: '2026-09-25',
        start: '13:00',
        end: '15:00',
        room: '301',
      }),
    ).toBe('2026-09-25_13:00-15:00_301')
  })

  it('parses the contract example back into date, start, end, room', () => {
    expect(parseSlotId('2026-09-25_13:00-15:00_301')).toEqual({
      date: '2026-09-25',
      start: '13:00',
      end: '15:00',
      room: '301',
    })
  })

  it('rejects malformed ids', () => {
    expect(() => parseSlotId('301')).toThrow(/無效的 slot_id/)
  })
})
