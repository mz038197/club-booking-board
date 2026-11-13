import { bookingsOf, bookSlot } from "@/server/bookings";
import { ApiError } from "@/server/http/errors";
import { studentRoute } from "@/server/http/student-route";

export const dynamic = "force-dynamic";

const BAD_BODY = "請求內容必須是 JSON：{ \"slot_id\": \"2026-12-09_13:00-14:00_A101\" }";

async function slotIdFrom(req: Request): Promise<string> {
  const body: unknown = await req.json().catch(() => null);
  const slotId = (body as { slot_id?: unknown } | null)?.slot_id;
  if (typeof slotId !== "string") throw new ApiError(400, "INVALID_REQUEST", BAD_BODY);
  return slotId;
}

/** bookSlot: 預約一個可借格，body 只有 `slot_id`. */
export const POST = studentRoute("bookSlot", async ({ req, deps, student, session, log }) => {
  const slotId = await slotIdFrom(req);
  log.slotId = slotId;
  const booking = await bookSlot(deps.db, {
    sessionId: session.id,
    slotId,
    studentId: student.studentId,
    now: deps.now(),
  });
  return Response.json(booking, { status: 201 });
});

/** listMyBookings: 列出我在目前堂課的預約. */
export const GET = studentRoute("listMyBookings", async ({ deps, student, session }) => {
  const bookings = await bookingsOf(deps.db, session.id, student.studentId);
  return Response.json({ session: { id: session.id, name: session.name }, bookings });
});
