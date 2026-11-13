"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LiveBoard } from "@/components/board/LiveBoard";

/** The 投影監看頁: the live board on the monitor endpoint, plus the teacher-only 投影顯示設定. */
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
  const toLogin = () => router.push("/login");
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

  return (
    <LiveBoard
      source={`/api/teacher/sessions/${sessionId}/monitor`}
      initialFollow={initialFollow}
      onFollowChange={(follow) => void save({ auto_follow: follow })}
      onUnauthorized={toLogin}
      controls={
        <>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#71717a", cursor: "pointer" }}>
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
            <p role="alert" style={{ margin: 0, fontSize: 12, color: "#dc2626" }}>
              設定沒有儲存，請再試一次
            </p>
          ) : null}
          <Link href={`/admin/classes/${classId}`} style={{ fontSize: 12, color: "#71717a" }}>
            ← 回到教師後台
          </Link>
        </>
      }
    />
  );
}
