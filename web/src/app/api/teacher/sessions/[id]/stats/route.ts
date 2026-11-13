import { sessionRoute } from "@/server/http/teacher-route";
import { statsOf } from "@/server/live";

export const dynamic = "force-dynamic";

/** 統計：可借格、已借、已呼叫的學生、已預約的學生. */
export const GET = sessionRoute(async ({ deps, session }) => {
  const s = await statsOf(deps.db, session.id);
  return Response.json({
    slot_count: s.slotCount,
    booked_count: s.bookedCount,
    called_students: s.calledStudents,
    booked_students: s.bookedStudents,
  });
});
