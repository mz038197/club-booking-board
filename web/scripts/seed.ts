/**
 * npm run db:seed — demo data for one class: a 目前堂課 with 可借格.
 * Class 56 is the class of the fake gateway's student keys (FAKE_KEYS.studentA/B).
 * Override with SEED_CLASS_ID. Running it again creates a new 目前堂課.
 */
import "./load-env";
import { dbFromEnv } from "../src/server/db";
import { migrate } from "../src/server/db/migrate";
import { FAKE_CLASS_ID } from "../src/server/router-gateway/fake";
import { addSlots, createSession, type SlotInput } from "../src/server/sessions";

const classId = Number(process.env.SEED_CLASS_ID ?? FAKE_CLASS_ID);
if (!Number.isInteger(classId)) throw new Error("SEED_CLASS_ID must be an integer.");

const dates = ["2026-12-09", "2026-12-10", "2026-12-16"];
const times: [string, string][] = [
  ["12:10", "13:00"],
  ["16:10", "17:00"],
];
const rooms = ["A101", "A102", "B201"];
const slots: SlotInput[] = dates.flatMap((date) =>
  times.flatMap(([start, end]) => rooms.map((room) => ({ date, start, end, room }))),
);

const db = await dbFromEnv(process.env);
try {
  await migrate(db);
  const session = await createSession(db, { classId, name: "示範堂課：社團教室預約" });
  await addSlots(db, session.id, slots);
  console.log(
    `Class ${classId}: 目前堂課 ${session.id} 「${session.name}」 with ${slots.length} 可借格.`,
  );
} finally {
  await db.close();
}
