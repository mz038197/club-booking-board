import { notFound } from "next/navigation";
import { managedClass } from "@/server/http/teacher-auth";
import { requireTeacherPage } from "@/server/teacher-page";
import { ui } from "@/app/ui";
import { AdminHeader } from "../../admin-header";

export const dynamic = "force-dynamic";

export default async function ClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const access = await requireTeacherPage();
  const raw = (await params).classId;
  if (!/^\d{1,9}$/.test(raw)) notFound();
  const cls = managedClass(access, Number(raw));
  return (
    <>
      <AdminHeader access={access} classId={cls ? cls.id : undefined} />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
        <div style={ui.card}>
          {cls ? (
            <>
              <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>{cls.name}</h1>
              {/* 堂課 list and the prep wizard / live mode arrive with #18–#22. */}
              <p style={{ ...ui.muted, margin: 0 }}>堂課管理即將上線。</p>
            </>
          ) : (
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>你沒有管理這個班級的權限</h1>
          )}
        </div>
      </main>
    </>
  );
}
