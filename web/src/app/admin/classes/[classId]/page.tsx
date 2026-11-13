import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { adminLogOf } from "@/server/admin-log";
import { sessionBookingsOf } from "@/server/bookings";
import type { Db } from "@/server/db";
import { studentOpenApi } from "@/server/openapi";
import { agentBuilderSettings } from "@/server/public-urls";
import { getDeps } from "@/server/deps";
import { statsOf } from "@/server/live";
import { rosterOf } from "@/server/students";
import { managedClass } from "@/server/http/teacher-auth";
import { boardOf, sessionById, sessionsOfClass } from "@/server/sessions";
import { requireTeacherPage } from "@/server/teacher-page";
import { ui } from "@/app/ui";
import { AdminHeader } from "../../admin-header";
import { LiveMode, type LiveData } from "./live-mode";
import { prepSteps, type SessionContext } from "./prep-steps";
import { SessionBar } from "./session-bar";
import { Workspace } from "./workspace";

export const dynamic = "force-dynamic";

/** Everything the ② 上課中 view shows, read in one go. */
async function liveData(db: Db, sessionId: string): Promise<LiveData> {
  const [stats, bookings, roster, adminLog] = await Promise.all([
    statsOf(db, sessionId),
    sessionBookingsOf(db, sessionId),
    rosterOf(db, sessionId),
    adminLogOf(db, sessionId, 50),
  ]);
  return { sessionId, stats, bookings, roster, adminLog };
}

/**
 * 班級頁: 堂課選單 (目前堂課, 新堂課, 切回) + the selected 堂課's workspace
 * (① 課前準備 wizard; ② 上課中). `?session=<id>` picks a 堂課;
 * default is the 目前堂課.
 */
export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const access = await requireTeacherPage();
  const raw = (await params).classId;
  if (!/^\d{1,9}$/.test(raw)) notFound();
  const cls = managedClass(access, Number(raw));
  if (!cls) {
    return (
      <>
        <AdminHeader access={access} />
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
          <div style={ui.card}>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>你沒有管理這個班級的權限</h1>
          </div>
        </main>
      </>
    );
  }

  const { db } = await getDeps();
  const sessions = await sessionsOfClass(db, cls.id);
  const wanted = (await searchParams).session;
  const picked =
    sessions.find((s) => s.id === wanted) ?? sessions.find((s) => s.isCurrent) ?? sessions[0] ?? null;
  const session = picked ? await sessionById(db, picked.id) : null;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const settings = agentBuilderSettings(process.env, origin);
  const ctx: SessionContext | null = session
    ? {
        cls,
        session,
        isCurrent: picked!.isCurrent,
        slots: await boardOf(db, session.id),
        agentBuilder: { settings, openApi: JSON.stringify(studentOpenApi(settings.apiBaseUrl), null, 2) },
        rosterCount: (await rosterOf(db, session.id)).length,
      }
    : null;

  return (
    <>
      <AdminHeader access={access} classId={cls.id} />
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 16px", display: "grid", gap: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{cls.name}</h1>
        <SessionBar
          classId={cls.id}
          selectedId={picked?.id ?? null}
          sessions={sessions.map((s) => ({ id: s.id, name: s.name, isCurrent: s.isCurrent, slotCount: s.slotCount }))}
        />
        {ctx ? (
          <Workspace
            key={ctx.session.id}
            steps={prepSteps(ctx)}
            live={
              <LiveMode
                data={await liveData(db, ctx.session.id)}
                monitorLink={
                  <a
                    href={`/admin/classes/${cls.id}/monitor?session=${ctx.session.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ ...ui.buttonOutline, textDecoration: "none" }}
                  >
                    投影監看頁 ↗
                  </a>
                }
              />
            }
          />
        ) : null}
      </main>
    </>
  );
}
