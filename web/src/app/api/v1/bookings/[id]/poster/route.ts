import { assertBookingOpen, POSTER_PAUSED_NOTICE } from "@/server/booking-rules";
import { studentRoute } from "@/server/http/student-route";
import { parsePoster, writePoster } from "@/server/poster";

export const dynamic = "force-dynamic";

/** writePoster: 把活動名稱與內文貼到我的一筆預約上；日期、時段、教室取自預約. */
export const POST = studentRoute<{ id: string }>("writePoster", async ({ req, deps, student, session, log }, { id }) => {
  assertBookingOpen(session, POSTER_PAUSED_NOTICE);
  const poster = parsePoster(await req.json().catch(() => null));
  const saved = await writePoster(deps.db, {
    sessionId: session.id,
    bookingId: id,
    studentId: student.studentId,
    poster,
    now: deps.now(),
    onFound: (slotId) => {
      log.slotId = slotId;
    },
  });
  return Response.json(saved);
});
