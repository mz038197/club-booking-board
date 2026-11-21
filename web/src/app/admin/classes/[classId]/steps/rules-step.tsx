"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ui } from "@/app/ui";
import { teacherApi } from "../../../teacher-api";

/** 課前準備・預約規則: 每人上限 (1–5). 何時能用由課堂金鑰決定，上課中要煞車用暫停. */
export function RulesStep({
  sessionId,
  perStudentLimit,
}: {
  sessionId: string;
  perStudentLimit: number;
}) {
  const router = useRouter();
  const [limit, setLimit] = useState(perStudentLimit);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await teacherApi("PUT", `/api/teacher/sessions/${sessionId}/rules`, {
        per_student_limit: limit,
      });
      setMessage({ ok: true, text: `已儲存：每人最多 ${limit} 格` });
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={ui.label}>每位學生最多預約</span>
        <span style={ui.row}>
          <select style={ui.input} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          格
        </span>
      </label>
      <p style={{ ...ui.muted, fontSize: 13, margin: 0 }}>
        ⚠ 這些規則要跟 RAG 用的「預約規範」文件寫得一致，否則 Agent 會講一套、系統做一套。
      </p>
      <div style={ui.row}>
        <button type="button" style={ui.buttonPrimary} disabled={busy} onClick={save}>
          儲存規則
        </button>
        {message ? (
          <span role="status" style={{ fontSize: 14, color: message.ok ? "var(--success-fg)" : "var(--danger-fg)" }}>
            {message.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
