import type { BoardSlot } from "./types";

/**
 * 可借格 booked since the previous poll (for the toast, the flash and auto-follow).
 * `prev = null` means this is the first snapshot: nothing is "new" yet.
 * Works on the 看板 alone, so any data source (monitor or 分享連結) can use it.
 */
export function newlyBooked(prev: BoardSlot[] | null, next: BoardSlot[]): BoardSlot[] {
  if (prev === null) return [];
  const before = new Map(prev.map((slot) => [slot.slot_id, slot]));
  return next.filter((slot) => {
    if (slot.status !== "booked") return false;
    const was = before.get(slot.slot_id);
    return !was || was.status !== "booked" || was.booked_by !== slot.booked_by;
  });
}
