import { ApiError } from "@/server/http/errors";
import { classRoute, isUuid, jsonBody, logAction } from "@/server/http/teacher-route";
import { createSession, sessionsOfClass, type SessionSummary } from "@/server/sessions";

export const dynamic = "force-dynamic";

const toJson = (s: SessionSummary) => ({
  id: s.id,
  name: s.name,
  created_at: s.createdAt,
  is_current: s.isCurrent,
  slot_count: s.slotCount,
});

/** 班級的堂課（新到舊），標示目前堂課. */
export const GET = classRoute(async ({ deps, cls }) => {
  const sessions = await sessionsOfClass(deps.db, cls.id);
  return Response.json({
    current_session_id: sessions.find((s) => s.isCurrent)?.id ?? null,
    sessions: sessions.map(toJson),
  });
});

/**
 * 建立堂課 `{ name, copy_from? }`：成為目前堂課；`copy_from` 為同班舊堂課時
 * 複製可借清單與預約規則（不含預約）.
 */
export const POST = classRoute(async (args) => {
  const { req, deps, cls } = args;
  const body = await jsonBody(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) {
    throw new ApiError(400, "INVALID_REQUEST", "堂課名稱必填（100 字以內）");
  }
  const copyFrom = body.copy_from;
  const copying = copyFrom !== undefined && copyFrom !== null && copyFrom !== "";
  if (copying && !isUuid(copyFrom)) {
    throw new ApiError(400, "INVALID_REQUEST", "要複製的堂課不在這個班級");
  }
  const session = await createSession(deps.db, {
    classId: cls.id,
    name,
    copyFrom: copying ? copyFrom : undefined,
  });
  await logAction(
    args,
    session.id,
    "createSession",
    copying
      ? `建立堂課「${session.name}」（複製可借清單與預約規則，不含預約），已成為目前堂課`
      : `建立堂課「${session.name}」，已成為目前堂課`,
  );
  return Response.json(
    { session: { id: session.id, class_id: session.classId, name: session.name, is_current: true } },
    { status: 201 },
  );
});
