import { assertBookingOpen } from "@/server/booking-rules";
import { cancelBooking } from "@/server/bookings";
import { studentRoute } from "@/server/http/student-route";

export const dynamic = "force-dynamic";

/** cancelBooking: 取消我在目前堂課的一筆預約. */
export const DELETE = studentRoute<{ id: string }>(
  "cancelBooking",
  async ({ deps, student, session, log }, { id }) => {
    assertBookingOpen(session, deps.now());
    await cancelBooking(deps.db, {
      sessionId: session.id,
      bookingId: id,
      studentId: student.studentId,
      onFound: (slotId) => {
        log.slotId = slotId;
      },
    });
    return new Response(null, { status: 204 });
  },
);
