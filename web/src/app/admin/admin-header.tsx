import type { TeacherAccess } from "@/server/http/teacher-auth";
import { ui } from "@/app/ui";
import { ClassPicker } from "./class-picker";

/** Admin header: 班級 menu on the left; teacher 顯示名稱 and 登出 on the right. */
export function AdminHeader({ access, classId }: { access: TeacherAccess; classId?: number }) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <strong style={{ fontSize: 15 }}>教師後台</strong>
        {access.classes.length > 0 ? <ClassPicker classes={access.classes} value={classId} /> : null}
        {access.isAdmin ? <span style={{ ...ui.muted, fontSize: 12 }}>管理員</span> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span data-testid="teacher-name" style={{ fontSize: 14 }}>
          {access.teacher.displayName}
        </span>
        <form action="/auth/logout" method="post" style={{ margin: 0 }}>
          <button type="submit" style={ui.buttonOutline}>
            登出
          </button>
        </form>
      </div>
    </header>
  );
}
