import type { SlotSpec } from '../api/types.ts'

const SLOT_ID_PATTERN =
  /^(?<date>\d{4}-\d{2}-\d{2})_(?<start>\d{2}:\d{2})-(?<end>\d{2}:\d{2})_(?<room>.+)$/

export function formatSlotId(slot: SlotSpec): string {
  return `${slot.date}_${slot.start}-${slot.end}_${slot.room}`
}

export function parseSlotId(slotId: string): SlotSpec {
  const match = SLOT_ID_PATTERN.exec(slotId)
  if (!match?.groups) {
    throw new Error(`無效的 slot_id：${slotId}`)
  }
  return {
    date: match.groups.date,
    start: match.groups.start,
    end: match.groups.end,
    room: match.groups.room,
  }
}

export function slotKey(slot: SlotSpec): string {
  return formatSlotId(slot)
}
