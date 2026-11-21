"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LiveBoard } from "@/components/board/LiveBoard";
import s from "@/components/board/board.module.css";
import { LOGIN_REQUIRED_PATH } from "@/auth/login-paths";
import type { BoardSlot } from "@/board/types";

/**
 * The 投影監看頁: the live board on the monitor endpoint, plus the teacher-only
 * 投影顯示設定 and 教師保留 (設保留／解除保留 under each 日展開 cell).
 */
export function MonitorBoard({
  classId,
  sessionId,
  initialMask,
  initialFollow,
}: {
  classId: number;
  sessionId: string;
  initialMask: boolean;
  initialFollow: boolean;
}) {
  const router = useRouter();
  const toLogin = () => router.push(LOGIN_REQUIRED_PATH);
  const [mask, setMask] = useState(initialMask);
  const [saveError, setSaveError] = useState(false);
  const settingsUrl = `/api/teacher/sessions/${sessionId}/display-settings`;

  const save = async (change: { mask_names?: boolean; auto_follow?: boolean }) => {
    try {
      const res = await fetch(settingsUrl, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(change),
      });
      if (res.status === 401) toLogin();
      setSaveError(!res.ok);
      return res.ok;
    } catch {
      setSaveError(true);
      return false;
    }
  };

  const [holdError, setHoldError] = useState<string | null>(null);
  const [holdBusy, setHoldBusy] = useState<string | null>(null);

  /** 設保留 (asks for the optional name) or 解除保留 on one 可借格 of the 日展開. */
  const toggleHold = async (slot: BoardSlot, refresh: () => void) => {
    const url = `/api/teacher/sessions/${sessionId}/slots/${encodeURIComponent(slot.slot_id)}/hold`;
    let init: RequestInit;
    if (slot.held) {
      if (!window.confirm(`解除 ${slot.room} ${slot.start}–${slot.end} 的保留？學生就能預約這一格。`)) return;
      init = { method: "DELETE" };
    } else {
      const name = window.prompt(`保留 ${slot.room} ${slot.start}–${slot.end}\n學生看到的名字（20 字以內，空白顯示「保留」）`, "");
      if (name === null) return;
      init = { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) };
    }
    setHoldBusy(slot.slot_id);
    try {
      const res = await fetch(url, init);
      if (res.status === 401) return toLogin();
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        setHoldError(err?.message ?? `保留沒有成功（${res.status}）`);
      } else {
        setHoldError(null);
      }
    } catch {
      setHoldError("連線中斷，保留沒有成功，請再試一次");
    } finally {
      setHoldBusy(null);
      refresh();
    }
  };

  return (
    <LiveBoard
      source={`/api/teacher/sessions/${sessionId}/monitor`}
      initialFollow={initialFollow}
      onFollowChange={(follow) => void save({ auto_follow: follow })}
      onUnauthorized={toLogin}
      cellAction={(slot, refresh) =>
        slot.status === "open" || slot.held ? (
          <button
            type="button"
            className={s.cellAction}
            disabled={holdBusy === slot.slot_id}
            onClick={() => void toggleHold(slot, refresh)}
          >
            {slot.held ? "解除保留" : "設保留"}
          </button>
        ) : null
      }
      controls={
        <>
          {holdError ? (
            <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>
              {holdError}
            </p>
          ) : null}
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--muted-fg)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={mask}
              onChange={async (e) => {
                const next = e.target.checked;
                setMask(next);
                if (!(await save({ mask_names: next }))) setMask(!next);
              }}
            />
            遮蔽顯示名稱（王小明 → 王○明）
          </label>
          {saveError ? (
            <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>
              設定沒有儲存，請再試一次
            </p>
          ) : null}
          <Link href={`/admin/classes/${classId}`} style={{ fontSize: 12, color: "var(--muted-fg)" }}>
            ← 回到教師後台
          </Link>
        </>
      }
    />
  );
}
