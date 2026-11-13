"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { teacherApi } from "../../teacher-api";

/**
 * 暫停 switch (上課中, top of the live view): the emergency brake. Default 預約進行中;
 * 暫停 blocks students' 預約 and 取消 only (queries keep working).
 */
export function PauseSwitch({ sessionId, paused }: { sessionId: string; paused: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = !paused;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await teacherApi("PUT", `/api/teacher/sessions/${sessionId}/pause`, { paused: running });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button
        type="button"
        role="switch"
        aria-checked={running}
        disabled={busy}
        onClick={toggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "16px 20px",
          borderRadius: 8,
          border: `1px solid ${running ? "var(--success-border)" : "var(--danger-border)"}`,
          background: running ? "var(--success-soft)" : "var(--danger-soft)",
          cursor: busy ? "wait" : "pointer",
          textAlign: "left",
          width: "100%",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "relative",
            flex: "0 0 auto",
            width: 52,
            height: 30,
            borderRadius: 999,
            background: running ? "var(--success)" : "var(--control-off)",
            transition: "background .15s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: running ? 25 : 3,
              width: 24,
              height: 24,
              borderRadius: 999,
              background: "var(--surface)",
              boxShadow: "var(--shadow-knob)",
              transition: "left .15s",
            }}
          />
        </span>
        <span style={{ display: "grid", gap: 2 }}>
          <strong style={{ fontSize: 18, color: running ? "var(--success-fg)" : "var(--danger-fg)" }}>
            {running ? "預約進行中" : "預約已暫停"}
          </strong>
          <span style={{ fontSize: 13, color: "var(--subtle-fg)" }}>
            {running
              ? "跟著學生金鑰時效；按一下緊急暫停"
              : "學生預約／取消收到 BOOKING_CLOSED（查詢照常）；按一下恢復"}
          </span>
        </span>
      </button>
      {error ? (
        <span role="alert" style={{ fontSize: 14, color: "var(--danger-fg)" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
