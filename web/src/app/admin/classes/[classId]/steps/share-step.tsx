"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ui } from "@/app/ui";
import { remainingText } from "@/board/format";
import { ConfirmButton } from "../../../confirm-button";
import { teacherApi } from "../../../teacher-api";

type Created = { token: string; url: string; created_at: string; expires_at: string };

/**
 * 課前準備・學生分享連結 (ADR 0005): 產生 / 重新產生 / 關閉 the 目前堂課's read-only
 * link, with its remaining time. Only a hash is stored, so the URL is shown only
 * right after it is made; to share it again later, 重新產生.
 */
export function ShareStep({
  sessionId,
  isCurrent,
  expiresAt: initialExpiresAt,
}: {
  sessionId: string;
  isCurrent: boolean;
  /** The live link's expiry (ISO), or null when there is none. */
  expiresAt: string | null;
}) {
  const router = useRouter();
  const [created, setCreated] = useState<Created | null>(null);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [now, setNow] = useState(() => new Date());
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = `/api/teacher/sessions/${sessionId}/share-link`;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const live = expiresAt !== null && new Date(expiresAt) > now;
  const url = live && created?.expires_at === expiresAt ? created.url : null;

  async function make() {
    setError(null);
    try {
      const res = await teacherApi<{ share_link: Created }>("POST", path);
      setCreated(res.share_link);
      setExpiresAt(res.share_link.expires_at);
      setNow(new Date());
      setCopied(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "沒有產生連結");
    }
  }

  async function close() {
    setError(null);
    try {
      await teacherApi("DELETE", path);
      setCreated(null);
      setExpiresAt(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "沒有關閉連結");
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("無法複製，請手動選取網址");
    }
  }

  const alert = error ? (
    <p role="alert" style={{ ...ui.alert, margin: 0 }}>
      {error}
    </p>
  ) : null;

  if (!isCurrent) {
    return (
      <p style={{ ...ui.muted, margin: 0 }}>
        分享連結只能為目前堂課產生。{live ? `這個堂課的舊連結仍有效（${remainingText(expiresAt!, now)}）。` : ""}
      </p>
    );
  }

  if (!live) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <p style={{ ...ui.muted, margin: 0 }}>
          產生後把連結給學生，學生不用登入就能看到這堂課的看板（唯讀、顯示完整名稱），確認自己的 Agent
          有沒有預約成功。12 小時後自動失效。
        </p>
        {alert}
        <div>
          <button type="button" style={ui.buttonPrimary} onClick={() => void make()}>
            產生學生分享連結
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <dl style={{ display: "grid", gap: 8, margin: 0 }}>
        <div>
          <dt style={{ ...ui.muted, fontSize: 13 }}>分享連結</dt>
          {url ? (
            <dd style={{ ...ui.row, margin: 0, flexWrap: "wrap" }}>
              <code style={{ ...ui.mono, wordBreak: "break-all" }}>{url}</code>
              <button type="button" style={ui.buttonGhost} onClick={() => void copy(url)}>
                {copied ? "已複製" : "複製"}
              </button>
            </dd>
          ) : (
            <dd style={{ ...ui.muted, margin: 0 }}>
              連結有效中。為了安全，網址只在產生當下顯示；要再分享請按「重新產生」（舊連結會立即失效）。
            </dd>
          )}
        </div>
        <div>
          <dt style={{ ...ui.muted, fontSize: 13 }}>有效期限</dt>
          <dd style={{ margin: 0, fontSize: 14 }}>{remainingText(expiresAt!, now)}</dd>
        </div>
      </dl>
      {alert}
      <div style={{ ...ui.row, flexWrap: "wrap" }}>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" style={ui.buttonOutline}>
            預覽學生看到的畫面 ↗
          </a>
        ) : null}
        <ConfirmButton label="重新產生" confirmLabel="確定？舊連結立即失效" onConfirm={() => void make()} />
        <ConfirmButton label="關閉分享" confirmLabel="確定關閉？" onConfirm={() => void close()} />
      </div>
    </div>
  );
}
