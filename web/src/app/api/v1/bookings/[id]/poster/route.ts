import { assertNotPaused, POSTER_PAUSED_NOTICE } from "@/server/booking-rules";
import { studentRoute } from "@/server/http/student-route";
import { writePoster } from "@/server/poster";

export const dynamic = "force-dynamic";

/** writePoster: 把活動名稱與內文貼到我的一筆預約上；日期、時段、教室取自預約. */
export const POST = studentRoute<{ id: string }>("writePoster", async ({ req, deps, student, session, log }, { id }) => {
  assertNotPaused(session, POSTER_PAUSED_NOTICE);
  const { slotId, poster } = await writePoster(deps.db, {
    sessionId: session.id,
    bookingId: id,
    studentId: student.studentId,
    body: await req.json().catch(() => null),
    now: deps.now(),
  });
  log.slotId = slotId;
  return Response.json(poster);
});
