import { getDeps } from "@/server/deps";
import { handle } from "@/server/http/errors";
import { requireTeacherSession } from "@/server/http/teacher-session";
import { monitorSnapshot } from "@/server/monitor";

export const dynamic = "force-dynamic";

/** 投影監看 snapshot of one 堂課 (polled about every 4 s by the monitor page). */
export const GET = handle(
  async (req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
    const deps = await getDeps();
    const { session } = await requireTeacherSession(req, deps, (await ctx.params).sessionId);
    return Response.json(await monitorSnapshot(deps.db, session), {
      headers: { "cache-control": "no-store" },
    });
  },
);
