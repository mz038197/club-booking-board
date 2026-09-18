import type { BoardSlot } from '../api/types.ts'

export type TimeBand = {
  start: string
  end: string
}

export type BoardGridModel = {
  dates: string[]
  rooms: string[]
  bands: TimeBand[]
  lookup: Map<string, BoardSlot>
}

export function cellKey(date: string, band: TimeBand, room: string): string {
  return `${date}|${band.start}|${band.end}|${room}`
}

export function compareRooms(a: string, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  if (!Number.isNaN(na) && !Number.isNaN(nb)) {
    return na - nb
  }
  return a.localeCompare(b, 'zh-Hant')
}

export function buildBoardGrid(slots: BoardSlot[]): BoardGridModel {
  const dates = [...new Set(slots.map((slot) => slot.date))].sort()
  const rooms = [...new Set(slots.map((slot) => slot.room))].sort(compareRooms)

  const bandSeen = new Set<string>()
  const bands: TimeBand[] = []
  for (const slot of slots) {
    const key = `${slot.start}|${slot.end}`
    if (bandSeen.has(key)) continue
    bandSeen.add(key)
    bands.push({ start: slot.start, end: slot.end })
  }
  bands.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))

  const lookup = new Map<string, BoardSlot>()
  for (const slot of slots) {
    lookup.set(cellKey(slot.date, { start: slot.start, end: slot.end }, slot.room), slot)
  }

  return { dates, rooms, bands, lookup }
}
