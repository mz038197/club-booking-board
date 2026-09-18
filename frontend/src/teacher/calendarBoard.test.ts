import { describe, expect, it } from 'vitest'
import type { BoardSlot } from '../api/types.ts'
import {
  buildCalendarMonth,
  dayExpandSlots,
  landingYearMonth,
  shiftYearMonth,
  visibleRoomChips,
  weekdayIndexSundayFirst,
} from './calendarBoard.ts'

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
    booked_by: '第三組',
  },
  {
    slot_id: '2026-09-25_15:10-17:10_301',
    date: '2026-09-25',
    start: '15:10',
    end: '17:10',
    room: '301',
    status: 'open',
  },
  {
    slot_id: '2026-10-02_09:00-11:00_401',
    date: '2026-10-02',
    start: '09:00',
    end: '11:00',
    room: '401',
    status: 'open',
  },
]

describe('landingYearMonth', () => {
  it('lands on the earliest month that has slot data', () => {
    expect(landingYearMonth(slots, new Date('2026-12-01T00:00:00'))).toEqual({
      year: 2026,
      month: 9,
    })
  })

  it('lands on the current calendar month when the board has no slots', () => {
    expect(landingYearMonth([], new Date('2026-04-18T08:00:00'))).toEqual({
      year: 2026,
      month: 4,
    })
  })
})

describe('buildCalendarMonth', () => {
  it('includes every calendar day of the month; empty days have no chips', () => {
    const month = buildCalendarMonth(slots, { year: 2026, month: 9 })
    expect(month.days).toHaveLength(30)
    expect(month.days[0]).toEqual({
      date: '2026-09-01',
      hasSlots: false,
      openCount: 0,
      bookedCount: 0,
      chips: [],
    })
    const day25 = month.days.find((day) => day.date === '2026-09-25')
    expect(day25).toEqual({
      date: '2026-09-25',
      hasSlots: true,
      openCount: 2,
      bookedCount: 1,
      chips: [
        { room: '301', status: 'open' },
        { room: '302', status: 'booked' },
      ],
    })
  })

  it('uses one room chip per classroom and mixed status when that room is both open and booked', () => {
    const mixed: BoardSlot[] = [
      {
        slot_id: '2026-09-10_09:00-11:00_301',
        date: '2026-09-10',
        start: '09:00',
        end: '11:00',
        room: '301',
        status: 'open',
      },
      {
        slot_id: '2026-09-10_13:00-15:00_301',
        date: '2026-09-10',
        start: '13:00',
        end: '15:00',
        room: '301',
        status: 'booked',
        booked_by: '第一組',
      },
    ]
    const month = buildCalendarMonth(mixed, { year: 2026, month: 9 })
    expect(month.days.find((day) => day.date === '2026-09-10')?.chips).toEqual([
      { room: '301', status: 'mixed' },
    ])
  })

  it('does not include slots from other months', () => {
    const month = buildCalendarMonth(slots, { year: 2026, month: 10 })
    expect(month.days).toHaveLength(31)
    expect(month.days.find((day) => day.date === '2026-10-02')?.openCount).toBe(1)
    expect(month.days.find((day) => day.date === '2026-10-02')?.chips).toEqual([
      { room: '401', status: 'open' },
    ])
    expect(month.days.every((day) => day.date.startsWith('2026-10-'))).toBe(true)
  })
})

describe('visibleRoomChips', () => {
  it('keeps the first four chips and reports leftover count', () => {
    const chips = [
      { room: '301', status: 'open' as const },
      { room: '302', status: 'booked' as const },
      { room: '303', status: 'open' as const },
      { room: '304', status: 'open' as const },
      { room: '305', status: 'booked' as const },
      { room: '306', status: 'open' as const },
    ]
    expect(visibleRoomChips(chips)).toEqual({
      chips: chips.slice(0, 4),
      overflow: 2,
    })
  })

  it('reports no overflow when chips fit', () => {
    expect(visibleRoomChips([{ room: '301', status: 'open' }])).toEqual({
      chips: [{ room: '301', status: 'open' }],
      overflow: 0,
    })
  })
})

describe('dayExpandSlots', () => {
  it('lists that day’s slots with time, room, status, and booked_by', () => {
    expect(dayExpandSlots(slots, '2026-09-25')).toEqual([
      {
        start: '13:00',
        end: '15:00',
        room: '301',
        status: 'open',
        booked_by: undefined,
      },
      {
        start: '13:00',
        end: '15:00',
        room: '302',
        status: 'booked',
        booked_by: '第三組',
      },
      {
        start: '15:10',
        end: '17:10',
        room: '301',
        status: 'open',
        booked_by: undefined,
      },
    ])
  })

  it('returns an empty list for a day with no slots', () => {
    expect(dayExpandSlots(slots, '2026-09-01')).toEqual([])
  })
})

describe('shiftYearMonth', () => {
  it('moves to the previous and next calendar month', () => {
    expect(shiftYearMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftYearMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
  })
})

describe('weekdayIndexSundayFirst', () => {
  it('places 2026-09-01 as Tuesday when weeks start on Sunday', () => {
    expect(weekdayIndexSundayFirst('2026-09-01')).toBe(2)
  })
})
