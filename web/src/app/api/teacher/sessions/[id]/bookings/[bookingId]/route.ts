import { forceCancelBooking } from "@/server/bookings";
import { logAction, sessionRoute } from "@/server/http/teacher-route";

export const dynamic = "force-dynamic";

/** 強制取消任一預約（UI 做二段確認）→ 204；不在這個堂課 → 404 NOT_FOUND. */
export const DELETE = sessionRoute<{ id: string; bookingId: string }>(async (args) => {
  const { deps, session, params } = args;
  const cancelled = await forceCancelBooking(deps.db, { sessionId: session.id, bookingId: params.bookingId });
  await logAction(args, session.id, "forceCancel", `強制取消 ${cancelled.displayName} 的預約 ${cancelled.slotId}`);
  return new Response(null, { status: 204 });
});
