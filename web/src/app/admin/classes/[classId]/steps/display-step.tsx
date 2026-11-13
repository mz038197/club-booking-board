"use client";

import Link from "next/link";
import { useState } from "react";
import { ui } from "@/app/ui";
import { teacherApi } from "../../../teacher-api";

type Settings = { mask_names: boolean; auto_follow: boolean };

/** 課前準備・投影顯示: 遮蔽名稱、自動跳日, and the link to the 投影監看頁. */
export function DisplayStep({
  classId,
  sessionId,
  initial,
}: {
  classId: number;
  sessionId: string;
  initial: Settings;
}) {
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function change(next: Partial<Settings>) {
    setError(null);
    try {
      const res = await teacherApi<{ settings: Settings }>(
        "PATCH",
        `/api/teacher/sessions/${sessionId}/display-settings`,
        next,
      );
      setSettings(res.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "設定沒有儲存");
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label style={{ ...ui.row, fontSize: 14, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={settings.mask_names}
          onChange={(e) => void change({ mask_names: e.target.checked })}
        />
        遮蔽顯示名稱（王小明 → 王○明）
      </label>
      <label style={{ ...ui.row, fontSize: 14, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={settings.auto_follow}
          onChange={(e) => void change({ auto_follow: e.target.checked })}
        />
        有人預約時自動跳到那一天
      </label>
      <p style={{ ...ui.muted, margin: 0, fontSize: 13 }}>
        只影響投影監看頁；學生分享連結一律顯示完整名稱。投影頁上也可以隨時切換。
      </p>
      {error ? (
        <p role="alert" style={{ ...ui.alert, margin: 0 }}>
          {error}
        </p>
      ) : null}
      <div>
        <Link
          href={`/admin/classes/${classId}/monitor?session=${sessionId}`}
          target="_blank"
          style={{ ...ui.buttonPrimary, display: "inline-block" }}
        >
          開啟投影監看
        </Link>
      </div>
    </div>
  );
}
