"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LiveBoard } from "@/components/board/LiveBoard";
import s from "@/components/board/board.module.css";
import { LOGIN_REQUIRED_PATH } from "@/auth/login-paths";
import type { BoardSlot } from "@/board/types";
import { cellDialogFor, type CellAction, type CellDialogContent } from "@/board/cell-dialog";
import { CellDialog } from "@/components/board/CellDialog";

/**
 * The 投影監看頁: the live board on the monitor endpoint, plus the teacher-only
 * 投影顯示設定, 教師保留 (設保留／解除保留 under each 日展開 cell) and 刪除海報
 * (under a 預約's 海報).
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

  const [cellError, setCellError] = useState<string | null>(null);
  const [cellBusy, setCellBusy] = useState<string | null>(null);

  /** Sends one 日展開 cell action (保留／刪除海報), then re-polls the board. */
  const sendCellAction = async (slot: BoardSlot, path: string, init: RequestInit, what: string, refresh: () => void) => {
    const url = `/api/teacher/sessions/${sessionId}/slots/${encodeURIComponent(slot.slot_id)}/${path}`;
    setCellBusy(slot.slot_id);
    try {
      const res = await fetch(url, init);
      if (res.status === 401) return toLogin();
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        setCellError(err?.message ?? `${what}沒有成功（${res.status}）`);
      } else {
        setCellError(null);
      }
    } catch {
      setCellError(`連線中斷，${what}沒有成功，請再試一次`);
    } finally {
      setCellBusy(null);
      refresh();
    }
  };

  /** The 日展開 cell whose action waits in the in-page dialog. */
  const [pending, setPending] = useState<{ slot: BoardSlot; dialog: CellDialogContent; refresh: () => void } | null>(
    null,
  );

  /** Runs a confirmed 設保留 (with the optional name)／解除保留／刪除海報 (the 預約 stays). */
  const runCellAction = (slot: BoardSlot, action: CellAction, name: string, refresh: () => void) => {
    switch (action) {
      case "setHold": {
        const init = { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) };
        return sendCellAction(slot, "hold", init, "保留", refresh);
      }
      case "releaseHold":
        return sendCellAction(slot, "hold", { method: "DELETE" }, "保留", refresh);
      case "deletePoster":
        return sendCellAction(slot, "poster", { method: "DELETE" }, "刪除海報", refresh);
    }
  };

  return (
    <>
      {pending ? (
        <CellDialog
          content={pending.dialog}
          onClose={() => setPending(null)}
          onConfirm={(name) => {
            const { slot, dialog, refresh } = pending;
            setPending(null);
            void runCellAction(slot, dialog.action, name, refresh);
          }}
        />
      ) : null}
      <LiveBoard
        source={`/api/teacher/sessions/${sessionId}/monitor`}
        initialFollow={initialFollow}
        onFollowChange={(follow) => void save({ auto_follow: follow })}
        onUnauthorized={toLogin}
        cellAction={(slot, refresh) => {
          const dialog = cellDialogFor(slot);
          return dialog ? (
            <button
              type="button"
              className={s.cellAction}
              disabled={cellBusy === slot.slot_id}
              onClick={() => setPending({ slot, dialog, refresh })}
            >
              {dialog.confirmLabel}
            </button>
          ) : null;
        }}
        controls={
          <>
            {cellError ? (
              <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>
                {cellError}
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
    </>
  );
}
