"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  buildCalendarMonth,
  dayExpandSlots,
  landingYearMonth,
  roomChipColor,
  roomsOnBoard,
  shiftYearMonth,
  weekdayIndexSundayFirst,
  type YearMonth,
} from "@/board/calendar";
import { clockTime, describeCall, shortDate, type Tone } from "@/board/format";
import { newlyBooked } from "@/board/live";
import { parseSlotId } from "@/board/slotId";
import type { BoardSnapshot, MonitorCall, MonitorRosterEntry } from "@/board/snapshot";
import type { BoardSlot } from "@/board/types";
import s from "./board.module.css";

/**
 * The live 看板 in the C2 layout: mini calendar + 時段 × 教室 matrix, 預約成功
 * toast/flash, optional auto-follow, and — when the source sends them — 名冊進度
 * and the API 呼叫紀錄. It polls `source` (a URL answering `BoardSnapshot` JSON)
 * every `pollMs`. It has no write actions of its own: teacher-only parts come in
 * through `controls`, so a read-only page (分享連結) renders it without them.
 */
export type LiveBoardProps = {
  /** URL polled for a `BoardSnapshot` (the monitor sends a `MonitorSnapshot`). */
  source: string;
  title?: string;
  pollMs?: number;
  /** Initial state of 「有人預約時自動跳到那一天」. */
  initialFollow?: boolean;
  /** Called when the viewer toggles auto-follow (the monitor saves it). */
  onFollowChange?: (follow: boolean) => void;
  /** Extra left-column content (teacher-only switches and links). */
  controls?: ReactNode;
  /** Called when the source answers 401 (the monitor sends the teacher to /login). */
  onUnauthorized?: () => void;
  /** Called (and polling stops) when the source answers 404 (the 分享連結 expired or was closed). */
  onNotFound?: () => void;
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const TOAST_MS = 6000;
const FLASH_MS = 1500;

type Toast = { slot: BoardSlot; retry: boolean; key: number };

export function LiveBoard({
  source,
  title = "教室出借看板",
  pollMs = 4000,
  initialFollow = false,
  onFollowChange,
  controls,
  onUnauthorized,
  onNotFound,
}: LiveBoardProps) {
  const [snap, setSnap] = useState<BoardSnapshot | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ym, setYm] = useState<YearMonth | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [follow, setFollow] = useState(initialFollow);
  const [toast, setToast] = useState<Toast | null>(null);
  const [flash, setFlash] = useState<{ ids: Set<string>; key: number } | null>(null);
  const [newCallFloor, setNewCallFloor] = useState<number>(Number.MAX_SAFE_INTEGER);

  const prevSlots = useRef<BoardSlot[] | null>(null);
  const lastCallId = useRef<number | null>(null);
  const followRef = useRef(initialFollow);
  const navigated = useRef(false);
  const seq = useRef(0);
  const unauthorizedRef = useRef(onUnauthorized);

  useEffect(() => {
    unauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const notFoundRef = useRef(onNotFound);
  useEffect(() => {
    notFoundRef.current = onNotFound;
  }, [onNotFound]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();

    const apply = (next: BoardSnapshot) => {
      const before = prevSlots.current;
      const fresh = newlyBooked(before, next.slots);
      prevSlots.current = next.slots;

      const maxCallId = (next.calls ?? []).reduce((m, c) => Math.max(m, c.id), lastCallId.current ?? 0);
      setNewCallFloor(lastCallId.current ?? maxCallId);
      lastCallId.current = maxCallId;

      setSnap(next);
      setUpdatedAt(new Date());
      setError(null);

      // 落月: on the first snapshot, and again when 可借格 first appear (unless the viewer moved).
      if (before === null || (before.length === 0 && next.slots.length > 0 && !navigated.current)) {
        const landing = landingYearMonth(next.slots, new Date());
        setYm(landing);
        setSelected(initialDay(next.slots, landing));
      }

      if (fresh.length > 0) {
        const latest = latestBooking(fresh, next.calls);
        const retry =
          next.calls?.find((c) => c.action === "bookSlot" && c.status === 201 && c.slot_id === latest.slot_id)
            ?.retry ?? false;
        seq.current += 1;
        setToast({ slot: latest, retry, key: seq.current });
        setFlash({ ids: new Set(fresh.map((f) => f.slot_id)), key: seq.current });
        if (followRef.current) {
          setSelected(latest.date);
          setYm(yearMonthOf(latest.date));
        }
      }
    };

    const tick = async () => {
      try {
        const res = await fetch(source, { cache: "no-store", signal: abort.signal });
        if (stopped) return;
        if (res.status === 401) {
          setError("登入已過期，請重新登入");
          unauthorizedRef.current?.();
          return;
        }
        if (res.status === 404 && notFoundRef.current) {
          setError("這個分享連結已失效");
          notFoundRef.current();
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next = (await res.json()) as BoardSnapshot;
        if (stopped) return;
        apply(next);
      } catch {
        if (stopped) return;
        setError("連線中斷，稍後自動重試");
      }
      timer = setTimeout(tick, pollMs);
    };
    void tick();

    return () => {
      stopped = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [source, pollMs]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast((cur) => (cur?.key === toast.key ? null : cur)), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash((cur) => (cur?.key === flash.key ? null : cur)), FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);

  const changeFollow = (next: boolean) => {
    followRef.current = next;
    setFollow(next);
    onFollowChange?.(next);
  };

  const slots = snap?.slots ?? [];
  const rooms = roomsOnBoard(slots);
  const chip = (room: string) => ({ ["--chip" as string]: roomChipColor(room, rooms) }) as CSSProperties;
  const booked = slots.filter((x) => x.status === "booked").length;
  const hasFeed = snap?.calls !== undefined;

  return (
    <div className={`${s.root} ${hasFeed || !snap ? "" : s.noFeed}`}>
      <aside className={s.left}>
        <div className={s.brand}>
          <h1>{title}</h1>
          {snap ? <span className={s.badge}>{snap.session.name}</span> : null}
          {snap?.session.paused ? <span className={`${s.badge} ${s.badgeWarn}`}>已暫停預約</span> : null}
        </div>

        {ym ? (
          <MiniCalendar
            slots={slots}
            ym={ym}
            selected={selected}
            onMonth={(delta) => {
              navigated.current = true;
              setYm(shiftYearMonth(ym, delta));
            }}
            onDay={(date) => {
              navigated.current = true;
              setSelected(date);
              if (followRef.current) changeFollow(false);
            }}
          />
        ) : null}

        <div className={`${s.card} ${s.totals}`}>
          <div>
            <span className={s.muted}>全部可借格</span>
            <strong>{slots.length}</strong>
          </div>
          <div>
            <span className={s.muted}>已借</span>
            <strong>{booked}</strong>
          </div>
        </div>

        <label className={s.check}>
          <input type="checkbox" checked={follow} onChange={(e) => changeFollow(e.target.checked)} />
          有人預約時自動跳到那一天
        </label>

        {controls ? <div className={s.controls}>{controls}</div> : null}
      </aside>

      <main className={s.main}>
        <div className={s.mainHead}>
          <h2>{selected ? shortDate(selected) : snap ? "選一天" : "載入中…"}</h2>
          <span className={s.live} role="status">
            <span className={`${s.liveDot} ${error ? s.liveDotDown : ""}`} aria-hidden="true" />
            {error ?? (updatedAt ? `更新於 ${clockTime(updatedAt)}` : "連線中…")}
          </span>
        </div>

        <div className={s.toastSlot} aria-live="polite">
          {toast ? (
            <div key={toast.key} className={s.toast}>
              <span className={s.toastIcon} aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>{toast.slot.booked_by}</strong> 成功預約{" "}
                <span className={`${s.chip} ${s.chipBooked}`} style={chip(toast.slot.room)}>
                  {toast.slot.room}
                </span>{" "}
                {shortDate(toast.slot.date)} {toast.slot.start}–{toast.slot.end}
                {toast.retry ? <span className={s.tag}>換格後成功</span> : null}
              </span>
            </div>
          ) : null}
        </div>

        <DayMatrix
          slots={slots}
          selected={selected}
          rooms={rooms}
          chip={chip}
          flash={flash}
          loading={!snap}
        />

        {snap?.roster ? <RosterProgress roster={snap.roster} chip={chip} /> : null}
      </main>

      {snap?.calls ? (
        <aside className={s.right}>
          <CallLog calls={snap.calls} newFloor={newCallFloor} chip={chip} />
        </aside>
      ) : null}
    </div>
  );
}

function MiniCalendar({
  slots,
  ym,
  selected,
  onMonth,
  onDay,
}: {
  slots: BoardSlot[];
  ym: YearMonth;
  selected: string | null;
  onMonth: (delta: number) => void;
  onDay: (date: string) => void;
}) {
  const month = buildCalendarMonth(slots, ym);
  const blanks = weekdayIndexSundayFirst(month.days[0].date);
  return (
    <div className={`${s.card} ${s.mini}`}>
      <div className={s.miniHead}>
        <button type="button" className={s.iconBtn} aria-label="上個月" onClick={() => onMonth(-1)}>
          ‹
        </button>
        <span>
          {ym.year} 年 {ym.month} 月
        </span>
        <button type="button" className={s.iconBtn} aria-label="下個月" onClick={() => onMonth(1)}>
          ›
        </button>
      </div>
      <div className={s.miniGrid}>
        {WEEKDAYS.map((w) => (
          <span key={w} className={s.wd}>
            {w}
          </span>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {month.days.map((d) => {
          const full = d.hasSlots && d.openCount === 0;
          const isSel = d.date === selected;
          return (
            <button
              key={d.date}
              type="button"
              className={`${s.mday} ${isSel ? s.mdaySel : ""} ${d.hasSlots ? "" : s.mdayEmpty}`}
              onClick={() => onDay(d.date)}
              aria-pressed={isSel}
              aria-label={`${d.date} 可借 ${d.openCount}，已借 ${d.bookedCount}`}
            >
              {Number(d.date.slice(-2))}
              {d.hasSlots ? <span className={`${s.dot} ${full ? s.dotFull : ""}`} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <p className={`${s.muted} ${s.miniFoot}`}>● 有可借格　○ 已借滿</p>
    </div>
  );
}

function DayMatrix({
  slots,
  selected,
  rooms,
  chip,
  flash,
  loading,
}: {
  slots: BoardSlot[];
  selected: string | null;
  rooms: string[];
  chip: (room: string) => CSSProperties;
  flash: { ids: Set<string>; key: number } | null;
  loading: boolean;
}) {
  if (loading) return <div className={`${s.card} ${s.empty} ${s.muted}`}>載入看板…</div>;
  const day = selected ? dayExpandSlots(slots, selected) : [];
  if (day.length === 0) {
    return (
      <div className={`${s.card} ${s.empty} ${s.muted}`}>
        {slots.length === 0 ? "這個堂課還沒有可借格。" : "這一天沒有可借格。"}
      </div>
    );
  }
  const times = [...new Map(day.map((x) => [`${x.start}–${x.end}`, x])).keys()];
  const dayRooms = rooms.filter((r) => day.some((x) => x.room === r));
  const slotIdOf = (x: { start: string; end: string; room: string }) =>
    `${selected}_${x.start}-${x.end}_${x.room}`;
  return (
    <div className={`${s.card} ${s.matrixWrap}`}>
      <table className={s.matrix}>
        <thead>
          <tr>
            <th scope="col" className={s.muted}>
              時段
            </th>
            {dayRooms.map((r) => (
              <th key={r} scope="col">
                <span className={`${s.chip} ${s.chipBooked}`} style={chip(r)}>
                  {r}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((t) => (
            <tr key={t}>
              <th scope="row">{t}</th>
              {dayRooms.map((r) => {
                const x = day.find((y) => `${y.start}–${y.end}` === t && y.room === r);
                if (!x) {
                  return (
                    <td key={r} className={`${s.cell} ${s.cellNone}`}>
                      —
                    </td>
                  );
                }
                const isNew = flash?.ids.has(slotIdOf(x)) ?? false;
                return (
                  <td
                    key={isNew ? `${r}-${flash?.key}` : r}
                    className={`${s.cell} ${x.status === "open" ? s.cellOpen : s.cellBooked} ${isNew ? s.flash : ""}`}
                    style={chip(r)}
                  >
                    {x.status === "open" ? "可借" : x.booked_by}
                    {isNew ? <span className={s.newBadge}>剛預約！</span> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RosterProgress({
  roster,
  chip,
}: {
  roster: MonitorRosterEntry[];
  chip: (room: string) => CSSProperties;
}) {
  const done = roster.filter((r) => r.booked_count > 0).length;
  const first = roster
    .filter((r) => r.first_booked_at)
    .sort((a, b) => (a.first_booked_at ?? "").localeCompare(b.first_booked_at ?? ""))[0]?.student_id;
  return (
    <section className={`${s.card} ${s.roster}`} aria-label="名冊進度">
      <div className={s.rosterHead}>
        <h3>名冊進度</h3>
        <span className={`${s.muted} ${s.rosterCount}`}>
          已預約 <strong>{done}</strong> / {roster.length} 位已呼叫的學生
        </span>
      </div>
      <div className={s.progress} aria-hidden="true">
        <span style={{ width: `${roster.length ? (done / roster.length) * 100 : 0}%` }} />
      </div>
      {roster.length === 0 ? (
        <p className={s.muted}>還沒有學生的 Agent 呼叫過。</p>
      ) : (
        <ol className={s.tiles}>
          {roster.map((r) => {
            const room = r.rooms[0];
            const state = room ? "done" : r.first_booked_at ? "cancelled" : "waiting";
            return (
              <li
                key={`${r.student_id}-${state}`}
                className={`${s.tile} ${state === "done" ? s.tileDone : ""} ${state === "cancelled" ? s.tileCancelled : ""}`}
                style={room ? chip(room) : undefined}
                title={
                  state === "done"
                    ? `${r.display_name}：借到 ${r.rooms.join("、")}`
                    : state === "cancelled"
                      ? `${r.display_name}：預約過，目前沒有可借格`
                      : `${r.display_name}：尚未預約成功`
                }
              >
                <span className={s.tileName}>{r.display_name}</span>
                <span className={s.tileSub}>
                  {state === "done" ? r.rooms.join("、") : state === "cancelled" ? "已取消" : "—"}
                </span>
                {r.student_id === first ? <span className={s.first}>首位</span> : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

const TONE: Record<Tone, string> = { ok: s.toneOk, quiet: s.toneQuiet, warn: s.toneWarn, bad: s.toneBad };

function CallLog({
  calls,
  newFloor,
  chip,
}: {
  calls: MonitorCall[];
  newFloor: number;
  chip: (room: string) => CSSProperties;
}) {
  return (
    <>
      <h2 className={s.feedTitle}>API 呼叫紀錄</h2>
      <p className={`${s.muted} ${s.feedDesc}`}>每個學生 Agent 打來的請求，成功與失敗都會列出，最新在上。</p>
      {calls.length === 0 ? <p className={s.muted}>等待第一個請求…</p> : null}
      <ol className={s.log}>
        {calls.map((c) => {
          const view = describeCall(c);
          const slot = slotOf(c.slot_id);
          return (
            <li key={c.id} className={`${s.logRow} ${c.id > newFloor ? s.logNew : ""}`}>
              <div className={s.logLine}>
                <span className={s.muted}>{clockTime(c.at)}</span>
                <strong>{c.display_name}</strong>
                <span>{view.request}</span>
                <span className={`${s.status} ${TONE[view.tone]}`}>{c.status}</span>
                {c.code ? <span className={`${s.status} ${TONE[view.tone]}`}>{c.code}</span> : null}
              </div>
              {c.slot_id || view.note || c.retry ? (
                <div className={s.logDetail}>
                  {slot ? (
                    <>
                      <span
                        className={`${s.chip} ${c.status === 201 ? s.chipBooked : s.chipOpen}`}
                        style={chip(slot.room)}
                      >
                        {slot.room}
                      </span>{" "}
                      {shortDate(slot.date)} {slot.start}
                    </>
                  ) : c.slot_id ? (
                    <span className={s.mono}>{c.slot_id}</span>
                  ) : null}
                  {view.note ? <span className={s.muted}> · {view.note}</span> : null}
                  {c.retry ? <span className={s.tag}>↻ 換格重試</span> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </>
  );
}

function slotOf(slotId: string | null) {
  if (!slotId) return null;
  try {
    return parseSlotId(slotId);
  } catch {
    return null;
  }
}

function yearMonthOf(date: string): YearMonth {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** First day to show: today when it has 可借格 in the 落月, else the earliest 可借格 day. */
function initialDay(slots: BoardSlot[], landing: YearMonth): string | null {
  if (slots.length === 0) return null;
  const today = todayIso();
  const prefix = `${landing.year}-${String(landing.month).padStart(2, "0")}`;
  if (today.startsWith(prefix) && slots.some((x) => x.date === today)) return today;
  return [...slots].map((x) => x.date).sort()[0];
}

/** The booking to announce: the newest successful bookSlot among them, else the last one. */
function latestBooking(fresh: BoardSlot[], calls: MonitorCall[] | undefined): BoardSlot {
  const ids = new Set(fresh.map((f) => f.slot_id));
  const call = calls?.find((c) => c.action === "bookSlot" && c.status === 201 && c.slot_id && ids.has(c.slot_id));
  return fresh.find((f) => f.slot_id === call?.slot_id) ?? fresh[fresh.length - 1];
}
