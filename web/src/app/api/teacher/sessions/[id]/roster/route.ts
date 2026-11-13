import { sessionRoute } from "@/server/http/teacher-route";
import { rosterOf } from "@/server/students";

export const dynamic = "force-dynamic";

/** 名冊：呼叫過的學生（不匯入名單），依第一次呼叫排序，含各自已借格數. */
export const GET = sessionRoute(async ({ deps, session }) => {
  const roster = await rosterOf(deps.db, session.id);
  return Response.json({
    students: roster.map((r) => ({
      student_id: r.studentId,
      display_name: r.displayName,
      first_call_at: r.firstCallAt,
      first_booked_at: r.firstBookedAt,
      booked_count: r.bookedCount,
    })),
  });
});
