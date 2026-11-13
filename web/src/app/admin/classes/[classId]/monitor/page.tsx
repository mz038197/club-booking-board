import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeps } from "@/server/deps";
import { managedClass } from "@/server/http/teacher-auth";
import { isUuid } from "@/server/http/teacher-route";
import { currentSessionOf, sessionById } from "@/server/sessions";
import { requireTeacherPage } from "@/server/teacher-page";
import { ui } from "@/app/ui";
import { MonitorBoard } from "./monitor-board";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "投影監看｜社團教室出借看板" };

/** 投影監看頁 of a 班級: its 目前堂課, or `?session=<id>` for another 堂課 of the 班級. */
export default async function MonitorPage({
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
  if (!cls) return <Notice title="你沒有管理這個班級的權限" />;

  const deps = await getDeps();
  const wanted = (await searchParams).session;
  const sessionId =
    typeof wanted === "string" ? wanted : (await currentSessionOf(deps.db, cls.id))?.id ?? null;
  if (!sessionId) {
    return <Notice title={`${cls.name}還沒有堂課`} detail="先在教師後台建立堂課與可借清單。" classId={cls.id} />;
  }
  const session = isUuid(sessionId) ? await sessionById(deps.db, sessionId) : null;
  if (!session || session.classId !== cls.id) notFound();

  return (
    <MonitorBoard
      classId={cls.id}
      sessionId={session.id}
      initialMask={session.maskNames}
      initialFollow={session.autoFollow}
    />
  );
}

function Notice({ title, detail, classId }: { title: string; detail?: string; classId?: number }) {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
      <div style={ui.card}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: detail ? "0 0 4px" : 0 }}>{title}</h1>
        {detail ? <p style={{ ...ui.muted, margin: "0 0 12px" }}>{detail}</p> : null}
        <Link href={classId ? `/admin/classes/${classId}` : "/admin"} style={ui.buttonOutline}>
          回到教師後台
        </Link>
      </div>
    </main>
  );
}
