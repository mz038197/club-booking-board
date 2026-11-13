import type { Db } from "./db";

/** 堂課 / 目前堂課 / 可借格 data access. */

export type Session = { id: string; classId: number; name: string; paused: boolean };

export type SlotInput = { date: string; start: string; end: string; room: string };

export type BoardSlot = {
  slot_id: string;
  date: string;
  start: string;
  end: string;
  room: string;
  status: "open" | "booked";
  booked_by?: string;
};

export function makeSlotId(slot: SlotInput): string {
  return `${slot.date}_${slot.start}-${slot.end}_${slot.room}`;
}

type SessionRow = { id: string; class_id: number; name: string; paused: boolean };

const toSession = (r: SessionRow): Session => ({
  id: r.id,
  classId: r.class_id,
  name: r.name,
  paused: r.paused,
});

/** Creates a 堂課; it becomes its class's 目前堂課. */
export async function createSession(
  db: Db,
  input: { classId: number; name: string },
): Promise<Session> {
  return db.transaction(async (tx) => {
    const [row] = await tx.query<SessionRow>(
      `INSERT INTO sessions (class_id, name) VALUES ($1, $2)
       RETURNING id, class_id, name, paused`,
      [input.classId, input.name],
    );
    await tx.query(
      `INSERT INTO class_current_sessions (class_id, session_id) VALUES ($1, $2)
       ON CONFLICT (class_id) DO UPDATE SET session_id = EXCLUDED.session_id`,
      [input.classId, row.id],
    );
    return toSession(row);
  });
}

/** Adds 可借格 to a 堂課, skipping ones it already has. */
export async function addSlots(db: Db, sessionId: string, slots: SlotInput[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const slot of slots) {
      await tx.query(
        `INSERT INTO slots (session_id, slot_id, date, start_time, end_time, room)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (session_id, slot_id) DO NOTHING`,
        [sessionId, makeSlotId(slot), slot.date, slot.start, slot.end, slot.room],
      );
    }
  });
}

export async function currentSessionOf(db: Db, classId: number): Promise<Session | null> {
  const [row] = await db.query<SessionRow>(
    `SELECT s.id, s.class_id, s.name, s.paused
       FROM class_current_sessions c JOIN sessions s ON s.id = c.session_id
      WHERE c.class_id = $1`,
    [classId],
  );
  return row ? toSession(row) : null;
}

/** 看板: every 可借格 of a 堂課 with its booking state and the booker's 顯示名稱. */
export async function boardOf(db: Db, sessionId: string): Promise<BoardSlot[]> {
  const rows = await db.query<{
    slot_id: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
    display_name: string | null;
    booked: boolean;
  }>(
    `SELECT s.slot_id, s.date, s.start_time, s.end_time, s.room,
            st.display_name, (b.id IS NOT NULL) AS booked
       FROM slots s
       LEFT JOIN bookings b ON b.session_id = s.session_id AND b.slot_id = s.slot_id
       LEFT JOIN students st ON st.student_id = b.student_id
      WHERE s.session_id = $1
      ORDER BY s.date, s.start_time, s.room`,
    [sessionId],
  );
  return rows.map((r) => ({
    slot_id: r.slot_id,
    date: r.date,
    start: r.start_time,
    end: r.end_time,
    room: r.room,
    status: r.booked ? "booked" : "open",
    ...(r.booked ? { booked_by: r.display_name ?? "" } : {}),
  }));
}
