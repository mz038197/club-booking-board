import type { Db } from "./db";
import { ApiError } from "./http/errors";
import { makeSlotId, type SlotInput } from "./sessions";

/** 可借清單 editing for teachers: 批次產生, 移除單格, 整批覆寫 (v1 rule: never drop a 已借 可借格). */

export const MAX_SLOTS_PER_REQUEST = 500;

export type SlotGrid = { dates: string[]; times: { start: string; end: string }[]; rooms: string[] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const bad = (message: string) => new ApiError(400, "INVALID_REQUEST", message);

function isRealDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function checkTimes(start: unknown, end: unknown): { start: string; end: string } {
  if (typeof start !== "string" || typeof end !== "string" || !TIME.test(start) || !TIME.test(end)) {
    throw bad("時段必須是 HH:MM，例如 12:10");
  }
  if (start >= end) throw bad(`時段 ${start}–${end} 的開始必須早於結束`);
  return { start, end };
}

function checkRoom(room: unknown): string {
  const trimmed = typeof room === "string" ? room.trim() : "";
  if (!trimmed || trimmed.length > 20) throw bad("教室編號必填（20 字以內）");
  return trimmed;
}

function checkDate(date: unknown): string {
  if (!isRealDate(date)) throw bad("日期必須是 YYYY-MM-DD");
  return date;
}

function nonEmptyArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw bad(`請至少選一個${what}`);
  return value;
}

/** Validates a 批次產生 request body; 400 INVALID_REQUEST otherwise. */
export function parseSlotGrid(body: Record<string, unknown>): SlotGrid {
  const dates = nonEmptyArray(body.dates, "日期").map(checkDate);
  const times = nonEmptyArray(body.times, "時段").map((t) => {
    const { start, end } = (t ?? {}) as { start?: unknown; end?: unknown };
    return checkTimes(start, end);
  });
  const rooms = nonEmptyArray(body.rooms, "教室").map(checkRoom);
  return { dates, times, rooms };
}

/** Validates a 整批覆寫 body `{ slots: [{date,start,end,room}] }`; 400 INVALID_REQUEST otherwise. */
export function parseSlotList(body: Record<string, unknown>): SlotInput[] {
  if (!Array.isArray(body.slots)) throw bad("請求內容必須是 { \"slots\": [...] }");
  return body.slots.map((s) => {
    const { date, start, end, room } = (s ?? {}) as Record<string, unknown>;
    return { date: checkDate(date), ...checkTimes(start, end), room: checkRoom(room) };
  });
}

/** Every 可借格 of the grid (dates × 時段 × 教室), without repeats. */
export function expandGrid(grid: SlotGrid): SlotInput[] {
  const out = new Map<string, SlotInput>();
  for (const date of grid.dates)
    for (const { start, end } of grid.times)
      for (const room of grid.rooms) {
        const slot = { date, start, end, room };
        out.set(makeSlotId(slot), slot);
      }
  return [...out.values()];
}

function capped(slots: SlotInput[]): SlotInput[] {
  if (slots.length > MAX_SLOTS_PER_REQUEST) {
    throw bad(`一次最多 ${MAX_SLOTS_PER_REQUEST} 格，這次是 ${slots.length} 格`);
  }
  return slots;
}

export type GenerateResult = { requested: number; added: number; skipped: number };

/** 批次產生: adds the grid's 可借格, skipping ones the 堂課 has. `preview` only counts. */
export async function generateSlots(
  db: Db,
  sessionId: string,
  grid: SlotGrid,
  { preview = false } = {},
): Promise<GenerateResult> {
  const slots = capped(expandGrid(grid));
  return db.transaction(async (tx) => {
    let added = 0;
    if (preview) {
      const have = new Set(await slotIdsOf(tx, sessionId));
      added = slots.filter((s) => !have.has(makeSlotId(s))).length;
    } else {
      for (const slot of slots) added += await insertSlot(tx, sessionId, slot);
    }
    return { requested: slots.length, added, skipped: slots.length - added };
  });
}

/** 移除單格: 404 NOT_FOUND when the 堂課 has no such 可借格; 409 CONFLICT when it is 已借. */
export async function removeSlot(db: Db, sessionId: string, slotId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [slot] = await tx.query<{ booked: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = s.session_id AND b.slot_id = s.slot_id) AS booked
         FROM slots s WHERE s.session_id = $1 AND s.slot_id = $2 FOR UPDATE`,
      [sessionId, slotId],
    );
    if (!slot) throw new ApiError(404, "NOT_FOUND", "這堂課沒有這個可借格");
    if (slot.booked) throw new ApiError(409, "CONFLICT", "這個可借格已經有人預約，不能移除；請先強制取消預約");
    await tx.query(`DELETE FROM slots WHERE session_id = $1 AND slot_id = $2`, [sessionId, slotId]);
  });
}

/**
 * 整批覆寫: the 堂課's 可借清單 becomes exactly `slots`. When that would drop a
 * 已借 可借格 → 409 CONFLICT and nothing is written.
 */
export async function replaceSlots(db: Db, sessionId: string, slots: SlotInput[]): Promise<void> {
  const incoming = new Map(capped(slots).map((s) => [makeSlotId(s), s]));
  await db.transaction(async (tx) => {
    // Lock the 堂課's 可借格 so a 預約 cannot land on one we are about to drop.
    const existing = await tx.query<{ slot_id: string; booked: boolean }>(
      `SELECT s.slot_id,
              EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = s.session_id AND b.slot_id = s.slot_id) AS booked
         FROM slots s WHERE s.session_id = $1 FOR UPDATE`,
      [sessionId],
    );
    const dropped = existing.filter((s) => !incoming.has(s.slot_id));
    const droppedBooked = dropped.filter((s) => s.booked).map((s) => s.slot_id);
    if (droppedBooked.length > 0) {
      throw new ApiError(
        409,
        "CONFLICT",
        `覆寫會移除已借的可借格（${droppedBooked.join("、")}），未寫入任何變更`,
      );
    }
    for (const s of dropped) {
      await tx.query(`DELETE FROM slots WHERE session_id = $1 AND slot_id = $2`, [sessionId, s.slot_id]);
    }
    for (const slot of incoming.values()) await insertSlot(tx, sessionId, slot);
  });
}

async function slotIdsOf(db: Db, sessionId: string): Promise<string[]> {
  const rows = await db.query<{ slot_id: string }>(`SELECT slot_id FROM slots WHERE session_id = $1`, [sessionId]);
  return rows.map((r) => r.slot_id);
}

/** 1 when inserted, 0 when the 堂課 already had it. */
async function insertSlot(db: Db, sessionId: string, slot: SlotInput): Promise<number> {
  const rows = await db.query(
    `INSERT INTO slots (session_id, slot_id, date, start_time, end_time, room)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (session_id, slot_id) DO NOTHING
     RETURNING slot_id`,
    [sessionId, makeSlotId(slot), slot.date, slot.start, slot.end, slot.room],
  );
  return rows.length;
}
