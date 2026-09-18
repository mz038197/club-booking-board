import type { BoardSlot, SlotStatus } from '../api/types.ts'
import { compareRooms } from '../board/groupSlots.ts'

export type YearMonth = {
  year: number
  month: number
}

export type ChipStatus = SlotStatus | 'mixed'

export type RoomChip = {
  room: string
  status: ChipStatus
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

function yearMonthFromIsoDate(isoDate: string): YearMonth {
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

function daysInMonth(yearMonth: YearMonth): number {
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

function roomChipsForDay(onDay: BoardSlot[]): RoomChip[] {
  const order: string[] = []
  const statuses = new Map<string, Set<SlotStatus>>()
  for (const slot of onDay) {
    if (!statuses.has(slot.room)) {
      order.push(slot.room)
      statuses.set(slot.room, new Set())
    }
    statuses.get(slot.room)?.add(slot.status)
  }
  return order.map((room) => {
    const found = statuses.get(room) ?? new Set<SlotStatus>()
    const hasOpen = found.has('open')
    const hasBooked = found.has('booked')
    const status: ChipStatus = hasOpen && hasBooked ? 'mixed' : hasBooked ? 'booked' : 'open'
    return { room, status }
  })
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
      chips: roomChipsForDay(onDay),
    })
  }
  return { yearMonth, days }
}

export function visibleRoomChips(chips: RoomChip[]): { chips: RoomChip[]; overflow: number } {
  if (chips.length <= CHIP_VISIBLE_MAX) {
    return { chips, overflow: 0 }
  }
  return { chips: chips.slice(0, CHIP_VISIBLE_MAX), overflow: chips.length - CHIP_VISIBLE_MAX }
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

export function slotStatusLabel(status: SlotStatus): string {
  return status === 'booked' ? '已借' : '可借'
}

export function chipStatusLabel(status: ChipStatus): string {
  if (status === 'mixed') return '可借與已借'
  return slotStatusLabel(status)
}

const ROOM_PALETTE = [
  '#3d7ea6',
  '#6b5ea8',
  '#1a7a8c',
  '#b85c7a',
  '#4c6e91',
  '#8b5ea8',
  '#2f6f8f',
  '#7a5c4a',
]

export function roomsOnBoard(slots: BoardSlot[]): string[] {
  return [...new Set(slots.map((slot) => slot.room))].sort(compareRooms)
}

export function roomChipColor(room: string, boardRooms: readonly string[]): string {
  const index = boardRooms.indexOf(room)
  const safe = index === -1 ? 0 : index
  return ROOM_PALETTE[safe % ROOM_PALETTE.length]
}

export function weekdayIndexSundayFirst(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}
