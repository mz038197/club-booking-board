import type { BoardSlot, SlotStatus } from '../api/types.ts'

export type YearMonth = {
  year: number
  month: number
}

export type RoomChip = {
  room: string
  status: SlotStatus
}

export type CalendarDayCell = {
  date: string
  hasSlots: boolean
  openCount: number
  bookedCount: number
  chips: RoomChip[]
}

export type CalendarMonth = {
  yearMonth: YearMonth
  days: CalendarDayCell[]
}

export type DayExpandSlot = {
  start: string
  end: string
  room: string
  status: SlotStatus
  booked_by?: string
}

const CHIP_VISIBLE_MAX = 4

export function landingYearMonth(slots: BoardSlot[], today: Date): YearMonth {
  if (slots.length === 0) {
    return { year: today.getFullYear(), month: today.getMonth() + 1 }
  }
  const earliest = [...slots].map((slot) => slot.date).sort()[0]
  return yearMonthFromIsoDate(earliest)
}

export function yearMonthFromIsoDate(isoDate: string): YearMonth {
  const [year, month] = isoDate.split('-').map(Number)
  return { year, month }
}

export function formatYearMonth(yearMonth: YearMonth): string {
  return `${yearMonth.year}-${String(yearMonth.month).padStart(2, '0')}`
}

export function shiftYearMonth(yearMonth: YearMonth, delta: number): YearMonth {
  const index = yearMonth.year * 12 + (yearMonth.month - 1) + delta
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return { year, month }
}

export function daysInMonth(yearMonth: YearMonth): number {
  return new Date(yearMonth.year, yearMonth.month, 0).getDate()
}

function isoDate(yearMonth: YearMonth, day: number): string {
  return `${formatYearMonth(yearMonth)}-${String(day).padStart(2, '0')}`
}

function slotsOnDate(slots: BoardSlot[], date: string): BoardSlot[] {
  return slots
    .filter((slot) => slot.date === date)
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        a.end.localeCompare(b.end) ||
        a.room.localeCompare(b.room, 'zh-Hant'),
    )
}

export function buildCalendarMonth(slots: BoardSlot[], yearMonth: YearMonth): CalendarMonth {
  const lastDay = daysInMonth(yearMonth)
  const days: CalendarDayCell[] = []
  for (let day = 1; day <= lastDay; day += 1) {
    const date = isoDate(yearMonth, day)
    const onDay = slotsOnDate(slots, date)
    days.push({
      date,
      hasSlots: onDay.length > 0,
      openCount: onDay.filter((slot) => slot.status === 'open').length,
      bookedCount: onDay.filter((slot) => slot.status === 'booked').length,
      chips: onDay.map((slot) => ({ room: slot.room, status: slot.status })),
    })
  }
  return { yearMonth, days }
}

export function visibleRoomChips(
  chips: RoomChip[],
  max = CHIP_VISIBLE_MAX,
): { chips: RoomChip[]; overflow: number } {
  if (chips.length <= max) {
    return { chips, overflow: 0 }
  }
  return { chips: chips.slice(0, max), overflow: chips.length - max }
}

export function dayExpandSlots(slots: BoardSlot[], date: string): DayExpandSlot[] {
  return slotsOnDate(slots, date).map((slot) => ({
    start: slot.start,
    end: slot.end,
    room: slot.room,
    status: slot.status,
    booked_by: slot.booked_by,
  }))
}

const ROOM_COLORS = [
  '#3d7ea6',
  '#6b5ea8',
  '#2a9d8f',
  '#c17f3a',
  '#b85c7a',
  '#4a8f4f',
  '#8a6d3b',
  '#5c7c99',
]

export function roomChipColor(room: string): string {
  let hash = 0
  for (let i = 0; i < room.length; i += 1) {
    hash = (hash * 31 + room.charCodeAt(i)) >>> 0
  }
  return ROOM_COLORS[hash % ROOM_COLORS.length]
}

export function weekdayIndexSundayFirst(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}
