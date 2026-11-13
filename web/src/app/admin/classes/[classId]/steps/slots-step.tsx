"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { BoardSlot } from "@/server/sessions";
import { ui } from "@/app/ui";
import { teacherApi } from "../../../teacher-api";

type Time = { start: string; end: string };
type Preview = { requested: number; added: number; skipped: number };

const PRESET_TIMES: Time[] = [
  { start: "12:10", end: "13:00" },
  { start: "13:10", end: "15:00" },
  { start: "16:10", end: "17:30" },
];

const sameTime = (a: Time, b: Time) => a.start === b.start && a.end === b.end;
const toggle = <T,>(list: T[], item: T, eq: (a: T, b: T) => boolean) =>
  list.some((x) => eq(x, item)) ? list.filter((x) => !eq(x, item)) : [...list, item];
const shortDate = (d: string) => {
  const day = "日一二三四五六"[new Date(`${d}T00:00:00Z`).getUTCDay()];
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}（${day}）`;
};

/** 課前準備・可借清單: 批次產生＋清單（移除單格）＋整批覆寫. */
export function SlotsStep({ sessionId, slots }: { sessionId: string; slots: BoardSlot[] }) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <SlotGenerator sessionId={sessionId} slots={slots} />
      <SlotList sessionId={sessionId} slots={slots} />
      <Overwrite sessionId={sessionId} slots={slots} />
    </div>
  );
}

function SlotGenerator({ sessionId, slots }: { sessionId: string; slots: BoardSlot[] }) {
  const router = useRouter();
  const knownRooms = useMemo(() => [...new Set(slots.map((s) => s.room))].sort(), [slots]);
  const [dates, setDates] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState("");
  const [times, setTimes] = useState<Time[]>([PRESET_TIMES[0]]);
  const [extraTimes, setExtraTimes] = useState<Time[]>([]);
  const [customTime, setCustomTime] = useState<Time>({ start: "", end: "" });
  const [rooms, setRooms] = useState<string[]>([]);
  const [extraRooms, setExtraRooms] = useState<string[]>([]);
  const [roomInput, setRoomInput] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const grid = useMemo(() => ({ dates, times, rooms }), [dates, times, rooms]);
  const complete = dates.length > 0 && times.length > 0 && rooms.length > 0;

  // 先顯示格數：ask the server how many are new (略過重複) whenever the grid changes.
  useEffect(() => {
    if (!complete) return;
    let stale = false;
    const t = window.setTimeout(() => {
      teacherApi<Preview>("POST", `/api/teacher/sessions/${sessionId}/slots/generate`, { ...grid, preview: true })
        .then((p) => !stale && setPreview(p))
        .catch((e: Error) => !stale && setMessage({ ok: false, text: e.message }));
    }, 250);
    return () => {
      stale = true;
      window.clearTimeout(t);
    };
  }, [grid, complete, sessionId, slots.length]);

  async function add() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await teacherApi<Preview>("POST", `/api/teacher/sessions/${sessionId}/slots/generate`, grid);
      setMessage({ ok: true, text: `已新增 ${r.added} 格${r.skipped ? `（略過重複 ${r.skipped} 格）` : ""}` });
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const allTimes = [...PRESET_TIMES, ...extraTimes];
  const allRooms = [...new Set([...knownRooms, ...extraRooms])];
  const shown = complete ? preview : null;

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <h3 style={{ ...ui.h2, fontSize: 15, margin: 0 }}>批次產生</h3>
      <Field label="日期">
        <div style={ui.row}>
          <input type="date" aria-label="日期" value={dateInput} onChange={(e) => setDateInput(e.target.value)} style={ui.input} />
          <button
            type="button"
            style={ui.buttonOutline}
            disabled={!dateInput}
            onClick={() => {
              if (dateInput && !dates.includes(dateInput)) setDates([...dates, dateInput].sort());
            }}
          >
            加入
          </button>
        </div>
        <div style={ui.row}>
          {dates.length === 0 ? <span style={{ ...ui.muted, fontSize: 13 }}>尚未選日期</span> : null}
          {dates.map((d) => (
            <button key={d} type="button" style={ui.pillOn} onClick={() => setDates(dates.filter((x) => x !== d))}>
              {shortDate(d)} ×
            </button>
          ))}
        </div>
      </Field>
      <Field label="時段">
        <div style={ui.row}>
          {allTimes.map((t) => {
            const on = times.some((x) => sameTime(x, t));
            return (
              <button
                key={`${t.start}-${t.end}`}
                type="button"
                aria-pressed={on}
                style={on ? ui.pillOn : ui.pill}
                onClick={() => setTimes(toggle(times, t, sameTime))}
              >
                {t.start}–{t.end}
              </button>
            );
          })}
        </div>
        <div style={ui.row}>
          <input type="time" aria-label="自訂時段開始" value={customTime.start} onChange={(e) => setCustomTime({ ...customTime, start: e.target.value })} style={ui.input} />
          –
          <input type="time" aria-label="自訂時段結束" value={customTime.end} onChange={(e) => setCustomTime({ ...customTime, end: e.target.value })} style={ui.input} />
          <button
            type="button"
            style={ui.buttonOutline}
            disabled={!customTime.start || !customTime.end || customTime.start >= customTime.end}
            onClick={() => {
              if (!allTimes.some((x) => sameTime(x, customTime))) setExtraTimes([...extraTimes, customTime]);
              if (!times.some((x) => sameTime(x, customTime))) setTimes([...times, customTime]);
              setCustomTime({ start: "", end: "" });
            }}
          >
            加入時段
          </button>
        </div>
      </Field>
      <Field label="教室">
        <div style={ui.row}>
          {allRooms.length === 0 ? <span style={{ ...ui.muted, fontSize: 13 }}>輸入教室編號後加入</span> : null}
          {allRooms.map((r) => {
            const on = rooms.includes(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                style={on ? ui.pillOn : ui.pill}
                onClick={() => setRooms(toggle(rooms, r, (a, b) => a === b))}
              >
                {r}
              </button>
            );
          })}
        </div>
        <form
          style={ui.row}
          onSubmit={(e) => {
            e.preventDefault();
            const r = roomInput.trim();
            if (!r) return;
            if (!allRooms.includes(r)) setExtraRooms([...extraRooms, r]);
            if (!rooms.includes(r)) setRooms([...rooms, r]);
            setRoomInput("");
          }}
        >
          <input aria-label="教室編號" placeholder="例如 301" maxLength={20} value={roomInput} onChange={(e) => setRoomInput(e.target.value)} style={{ ...ui.input, width: 140 }} />
          <button type="submit" style={ui.buttonOutline} disabled={!roomInput.trim()}>
            加入教室
          </button>
        </form>
      </Field>
      <div style={{ ...ui.row, justifyContent: "space-between", borderTop: "1px solid #e4e4e7", paddingTop: 12 }}>
        <span style={{ fontSize: 14 }} data-testid="generate-preview">
          {dates.length} 天 × {times.length} 時段 × {rooms.length} 間 ={" "}
          <strong>{dates.length * times.length * rooms.length}</strong> 格
          {shown && shown.skipped > 0 ? <span style={ui.muted}>（其中 {shown.skipped} 格已存在，會略過）</span> : null}
        </span>
        <button type="button" style={ui.buttonPrimary} disabled={!complete || busy || !shown || shown.added === 0} onClick={add}>
          {busy ? "新增中…" : `新增 ${shown ? shown.added : 0} 格`}
        </button>
      </div>
      {message ? (
        <p style={message.ok ? { ...ui.muted, margin: 0, color: "#166534" } : { ...ui.alert, margin: 0 }}>{message.text}</p>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span style={ui.label}>{label}</span>
      {children}
    </div>
  );
}

function SlotList({ sessionId, slots }: { sessionId: string; slots: BoardSlot[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const dates = [...new Set(slots.map((s) => s.date))];
  const booked = slots.filter((s) => s.status === "booked").length;

  async function remove(slotId: string) {
    setBusy(slotId);
    setError(null);
    try {
      await teacherApi("DELETE", `/api/teacher/sessions/${sessionId}/slots/${encodeURIComponent(slotId)}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h3 style={{ ...ui.h2, fontSize: 15, margin: 0 }}>
        可借清單 <span style={{ ...ui.muted, fontWeight: 400 }}>（{slots.length} 格，已借 {booked}）</span>
      </h3>
      {error ? <p style={{ ...ui.alert, margin: 0 }}>{error}</p> : null}
      {slots.length === 0 ? (
        <p style={{ ...ui.muted, margin: 0 }}>這堂課還沒有可借格。</p>
      ) : (
        <div style={{ border: "1px solid #e4e4e7", borderRadius: 8, maxHeight: 360, overflow: "auto" }}>
          {dates.map((d) => (
            <div key={d}>
              <div style={{ position: "sticky", top: 0, background: "#f4f4f5", padding: "4px 12px", fontSize: 13, fontWeight: 600 }}>
                {shortDate(d)}
              </div>
              {slots
                .filter((s) => s.date === d)
                .map((s) => (
                  <div
                    key={s.slot_id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 80px 1fr auto",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 12px",
                      borderTop: "1px solid #f4f4f5",
                      fontSize: 14,
                    }}
                  >
                    <span style={ui.mono}>
                      {s.start}–{s.end}
                    </span>
                    <span>{s.room}</span>
                    <span style={s.status === "booked" ? {} : { color: "#16a34a" }}>
                      {s.status === "booked" ? `已借・${s.booked_by}` : "可借"}
                    </span>
                    {s.status === "booked" ? (
                      <span style={{ ...ui.muted, fontSize: 12 }}>已借不能移除</span>
                    ) : (
                      <button type="button" style={ui.buttonGhost} disabled={busy === s.slot_id} onClick={() => remove(s.slot_id)}>
                        移除
                      </button>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const LINE = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})\s+(.+)$/;

/** 整批覆寫: one 可借格 per line 「2026-12-09 12:10-13:00 301」. */
function Overwrite({ sessionId, slots }: { sessionId: string; slots: BoardSlot[] }) {
  const router = useRouter();
  const current = slots.map((s) => `${s.date} ${s.start}-${s.end} ${s.room}`).join("\n");
  const [text, setText] = useState(current);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setMessage(null);
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed = [];
    for (const [i, line] of lines.entries()) {
      const m = LINE.exec(line);
      if (!m) return setMessage({ ok: false, text: `第 ${i + 1} 行格式不對：「${line}」` });
      parsed.push({ date: m[1], start: m[2], end: m[3], room: m[4].trim() });
    }
    setBusy(true);
    try {
      await teacherApi("PUT", `/api/teacher/sessions/${sessionId}/slots`, { slots: parsed });
      setMessage({ ok: true, text: `已覆寫為 ${parsed.length} 格` });
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details onToggle={(e) => (e.currentTarget.open ? setText(current) : null)}>
      <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 500 }}>進階：整批覆寫可借清單</summary>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        <p style={{ ...ui.muted, fontSize: 13, margin: 0 }}>
          一行一格：<code>2026-12-09 12:10-13:00 301</code>。沒列出的可借格會被移除；會移除已借格時整批拒絕、不寫入。
        </p>
        <textarea
          aria-label="整批覆寫可借清單"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ ...ui.input, ...ui.mono, width: "100%", boxSizing: "border-box" }}
        />
        {message ? (
          <p style={message.ok ? { ...ui.muted, margin: 0, color: "#166534" } : { ...ui.alert, margin: 0 }}>{message.text}</p>
        ) : null}
        <div>
          <button type="button" style={ui.buttonPrimary} disabled={busy} onClick={save}>
            {busy ? "覆寫中…" : "覆寫可借清單"}
          </button>
        </div>
      </div>
    </details>
  );
}
