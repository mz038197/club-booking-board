import Link from "next/link";
import { requireTeacherPage } from "@/server/teacher-page";
import { ui } from "@/app/ui";
import { AdminHeader } from "./admin-header";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const access = await requireTeacherPage();
  return (
    <>
      <AdminHeader access={access} />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
        {access.classes.length === 0 ? (
          <div style={ui.card}>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>你沒有可管理的班級</h1>
            <p style={{ ...ui.muted, margin: 0 }}>班級由 router 管理；請在 router 建立或取得班級後重新整理。</p>
          </div>
        ) : (
          <div style={ui.card}>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px" }}>選擇班級</h1>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {access.classes.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/classes/${c.id}`} style={{ ...ui.buttonOutline, display: "block", textDecoration: "none" }}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
