"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ui } from "@/app/ui";
import { ConfirmButton } from "../../confirm-button";
import { teacherApi } from "../../teacher-api";

export type SessionOption = { id: string; name: string; isCurrent: boolean; slotCount: number };

/** 堂課選單＋目前堂課標示＋切回（二段確認）＋新堂課. */
export function SessionBar({
  classId,
  sessions,
  selectedId,
}: {
  classId: number;
  sessions: SessionOption[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  async function makeCurrent(id: string) {
    setError(null);
    try {
      await teacherApi("POST", `/api/teacher/sessions/${id}/current`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section style={{ ...ui.card, padding: 16, display: "grid", gap: 12 }}>
      <div style={{ ...ui.row, justifyContent: "space-between" }}>
        <div style={ui.row}>
          {selected ? (
            <>
              <select
                aria-label="選擇堂課"
                value={selected.id}
                onChange={(e) => router.push(`/admin/classes/${classId}?session=${e.target.value}`)}
                style={{ ...ui.input, maxWidth: 320 }}
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.isCurrent ? "● " : ""}
                    {s.name}
                  </option>
                ))}
              </select>
              {selected.isCurrent ? (
                <span style={ui.badge} data-testid="current-session">
                  目前堂課
                </span>
              ) : (
                <>
                  <span style={{ ...ui.muted, fontSize: 13 }}>學生現在不在這個堂課</span>
                  <ConfirmButton
                    label="設為目前堂課"
                    confirmLabel="確定？學生之後都進這堂"
                    onConfirm={() => makeCurrent(selected.id)}
                  />
                </>
              )}
            </>
          ) : (
            <span style={ui.muted}>這個班級還沒有堂課</span>
          )}
        </div>
        <button type="button" style={creating ? ui.buttonOutline : ui.buttonPrimary} onClick={() => setCreating(!creating)}>
          {creating ? "取消" : "＋ 新堂課"}
        </button>
      </div>
      {error ? <p style={{ ...ui.alert, margin: 0 }}>{error}</p> : null}
      {creating || sessions.length === 0 ? (
        <NewSessionForm
          classId={classId}
          sessions={sessions}
          defaultCopyFrom={selected?.id ?? ""}
          onDone={() => setCreating(false)}
        />
      ) : null}
    </section>
  );
}

function NewSessionForm({
  classId,
  sessions,
  defaultCopyFrom,
  onDone,
}: {
  classId: number;
  sessions: SessionOption[];
  defaultCopyFrom: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [copyFrom, setCopyFrom] = useState(defaultCopyFrom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await teacherApi("POST", `/api/teacher/classes/${classId}/sessions`, {
        name,
        ...(copyFrom ? { copy_from: copyFrom } : {}),
      });
      onDone();
      setName("");
      router.push(`/admin/classes/${classId}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, borderTop: "1px solid #e4e4e7", paddingTop: 12 }}>
      <p style={{ ...ui.muted, margin: 0 }}>建立後自動成為這個班級的目前堂課；學生不用知道堂課。</p>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={ui.label}>名稱</span>
        <input
          required
          maxLength={100}
          value={name}
          placeholder="例如：12/16 Agent Builder（三）"
          onChange={(e) => setName(e.target.value)}
          style={ui.input}
        />
      </label>
      {sessions.length > 0 ? (
        <label style={{ display: "grid", gap: 4 }}>
          <span style={ui.label}>複製設定自</span>
          <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} style={ui.input}>
            <option value="">（不複製，從空白開始）</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}（{s.slotCount} 格可借清單、預約規則；不含預約）
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {error ? <p style={{ ...ui.alert, margin: 0 }}>{error}</p> : null}
      <div>
        <button type="submit" disabled={busy || !name.trim()} style={ui.buttonPrimary}>
          {busy ? "建立中…" : "建立堂課"}
        </button>
      </div>
    </form>
  );
}
