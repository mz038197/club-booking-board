import { sessionBookingsOf } from "@/server/bookings";
import { sessionRoute } from "@/server/http/teacher-route";

export const dynamic = "force-dynamic";

/** 堂課的全部預約（看板順序），含學生與顯示名稱. */
export const GET = sessionRoute(async ({ deps, session }) => {
  return Response.json({ bookings: await sessionBookingsOf(deps.db, session.id) });
});
