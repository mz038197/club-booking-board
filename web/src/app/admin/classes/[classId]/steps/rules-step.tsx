"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BookingWindow } from "@/server/sessions";
import { ui } from "@/app/ui";
import { teacherApi } from "../../../teacher-api";

/** 課前準備・預約規則: 每人上限 (1–5) + 上課當天可預約時間窗 (可不限). */
export function RulesStep({
  sessionId,
  perStudentLimit,
  bookingWindow,
}: {
  sessionId: string;
  perStudentLimit: number;
  bookingWindow: BookingWindow | null;
}) {
  const router = useRouter();
  const [limit, setLimit] = useState(perStudentLimit);
  const [limitWindow, setLimitWindow] = useState(bookingWindow !== null);
  const [start, setStart] = useState(bookingWindow?.start ?? "12:30");
  const [end, setEnd] = useState(bookingWindow?.end ?? "15:10");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await teacherApi("PUT", `/api/teacher/sessions/${sessionId}/rules`, {
        per_student_limit: limit,
        booking_window: limitWindow ? { start, end } : null,
      });
      setMessage({
        ok: true,
        text: `已儲存：每人最多 ${limit} 格，${limitWindow ? `上課當天 ${start}–${end} 可預約與取消` : "不限時間"}`,
      });
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
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 6 }}>
        <legend style={{ ...ui.label, padding: 0, marginBottom: 6 }}>可預約時間（上課當天，台灣時間）</legend>
        <label style={{ ...ui.row, fontSize: 14 }}>
          <input type="checkbox" checked={limitWindow} onChange={(e) => setLimitWindow(e.target.checked)} />
          限定時間（不勾選＝課堂金鑰有效期間都能預約）
        </label>
        {limitWindow ? (
          <span style={ui.row}>
            <input
              type="time"
              aria-label="開始時間"
              style={ui.input}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            –
            <input type="time" aria-label="結束時間" style={ui.input} value={end} onChange={(e) => setEnd(e.target.value)} />
          </span>
        ) : null}
      </fieldset>
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
