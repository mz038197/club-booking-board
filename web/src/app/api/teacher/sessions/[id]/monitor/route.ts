import { sessionRoute } from "@/server/http/teacher-route";
import { monitorSnapshot } from "@/server/monitor";

export const dynamic = "force-dynamic";

/** 投影監看 snapshot of one 堂課 (polled about every 4 s by the monitor page). */
export const GET = sessionRoute(async ({ deps, session }) =>
  Response.json(await monitorSnapshot(deps.db, session), {
    headers: { "cache-control": "no-store" },
  }),
);
