"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { AdminLogEntry } from "@/server/admin-log";
import type { SessionBooking } from "@/server/bookings";
import type { SessionStats } from "@/server/live";
import type { RosterEntry } from "@/server/students";
import { ui } from "@/app/ui";
import { ConfirmButton } from "../../confirm-button";
import { teacherApi } from "../../teacher-api";

/** How often the 上課中 view re-reads the server (看板輪詢, ADR 0002). */
const POLL_MS = 4000;

export type LiveData = {
  sessionId: string;
  stats: SessionStats;
  bookings: SessionBooking[];
  roster: RosterEntry[];
  adminLog: AdminLogEntry[];
};

const shortDate = (d: string) => {
  const day = "日一二三四五六"[new Date(`${d}T00:00:00Z`).getUTCDay()];
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}（${day}）`;
};
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("zh-Hant", { hour12: false, timeZone: "Asia/Taipei" });

/**
 * ② 上課中 (原型版本 C): 暫停＋投影監看頁＋重置堂課 on top, then 統計, 預約（可強制取消）,
 * 名冊, 學生分享連結 and 教師操作紀錄. Re-reads the server every few seconds.
 *
 * Slots for other tickets: `pauseSwitch` (#19 暫停 switch), `monitorLink` (#21 投影監看頁),
 * `shareLink` (#22 學生分享連結 card).
 */
export function LiveMode({
  data,
  pauseSwitch,
  monitorLink,
  shareLink,
}: {
  data: LiveData;
  pauseSwitch?: ReactNode;
  monitorLink?: ReactNode;
  shareLink?: ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => router.refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [router]);

  async function act(method: string, path: string) {
    setError(null);
    try {
      await teacherApi(method, `/api/teacher/sessions/${data.sessionId}${path}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ ...ui.card, padding: 16, ...ui.row, justifyContent: "space-between", gap: 16 }}>
        {/* #19: 暫停 switch (big, default off) goes here. */}
        {pauseSwitch ?? <span style={ui.muted}>暫停開關（#19）</span>}
        <div style={ui.row}>
          {/* #21: link to the 投影監看頁 goes here. */}
          {monitorLink}
          <ConfirmButton
            label="重置堂課"
            confirmLabel="確定重置？清空全部預約與 API 呼叫紀錄"
            onConfirm={() => act("POST", "/reset")}
          />
        </div>
      </section>
      {error ? <p style={{ ...ui.alert, margin: 0 }}>{error}</p> : null}
      <Stats stats={data.stats} />
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <section style={{ ...ui.card, padding: 16, flex: "1 1 480px", minWidth: 0 }}>
          <h2 style={ui.h2}>預約（可強制取消）</h2>
          <BookingList bookings={data.bookings} onCancel={(id) => act("DELETE", `/bookings/${id}`)} />
        </section>
        <div style={{ display: "grid", gap: 16, flex: "1 1 320px", minWidth: 0 }}>
          <section style={{ ...ui.card, padding: 16 }}>
            <h2 style={ui.h2}>名冊（{data.roster.length} 人呼叫過）</h2>
            <Roster roster={data.roster} />
          </section>
          {/* #22: 學生分享連結 card goes here. */}
          {shareLink ? (
            <section style={{ ...ui.card, padding: 16 }}>
              <h2 style={ui.h2}>學生分享連結</h2>
              {shareLink}
            </section>
          ) : null}
          <section style={{ ...ui.card, padding: 16 }}>
            <h2 style={ui.h2}>操作紀錄</h2>
            <AdminLog entries={data.adminLog} />
          </section>
        </div>
      </div>
    </div>
  );
}

function Stats({ stats }: { stats: SessionStats }) {
  const items = [
    ["可借格", stats.slotCount],
    ["已借", stats.bookedCount],
    ["已呼叫的學生", stats.calledStudents],
    ["已預約的學生", stats.bookedStudents],
  ] as const;
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, margin: 0 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ ...ui.card, padding: 16 }}>
          <dt style={{ ...ui.muted, fontSize: 13 }}>{label}</dt>
          <dd style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function BookingList({ bookings, onCancel }: { bookings: SessionBooking[]; onCancel: (bookingId: string) => void }) {
  if (bookings.length === 0) return <p style={{ ...ui.muted, margin: 0 }}>還沒有預約。</p>;
  const dates = [...new Set(bookings.map((b) => b.date))];
  return (
    <div style={{ border: "1px solid #e4e4e7", borderRadius: 8, maxHeight: 520, overflow: "auto" }}>
      {dates.map((d) => (
        <div key={d}>
          <div style={{ position: "sticky", top: 0, background: "#f4f4f5", padding: "4px 12px", fontSize: 13, fontWeight: 600 }}>
            {shortDate(d)}
          </div>
          {bookings
            .filter((b) => b.date === d)
            .map((b) => (
              <div
                key={b.booking_id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 70px 1fr auto",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  borderTop: "1px solid #f4f4f5",
                  fontSize: 14,
                }}
              >
                <span style={ui.mono}>
                  {b.start}–{b.end}
                </span>
                <span>{b.room}</span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {b.display_name} <span style={{ ...ui.muted, fontSize: 12 }}>{clock(b.booked_at)}</span>
                </span>
                <ConfirmButton
                  label="強制取消"
                  confirmLabel="確定取消？"
                  style={ui.buttonGhost}
                  onConfirm={() => onCancel(b.booking_id)}
                />
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

/** 名冊：不匯入；呼叫過的學生才出現，依第一次呼叫排序. */
function Roster({ roster }: { roster: RosterEntry[] }) {
  if (roster.length === 0) {
    return (
      <p style={{ ...ui.muted, margin: 0 }}>還沒有學生呼叫過。學生的 Agent 第一次呼叫時，名字就會出現在這裡。</p>
    );
  }
  return (
    <ol style={{ margin: 0, paddingLeft: 24, display: "grid", gap: 4, fontSize: 14, maxHeight: 320, overflow: "auto" }}>
      {roster.map((r) => (
        <li key={r.studentId}>
          <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span>{r.displayName}</span>
            <span style={r.bookedCount ? { color: "#166534" } : { ...ui.muted, fontSize: 14 }}>
              {r.bookedCount ? `已預約 ${r.bookedCount} 格` : "尚未預約"}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function AdminLog({ entries }: { entries: AdminLogEntry[] }) {
  if (entries.length === 0) return <p style={{ ...ui.muted, margin: 0 }}>還沒有操作。</p>;
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6, fontSize: 13, maxHeight: 280, overflow: "auto" }}>
      {entries.map((e, i) => (
        <li key={`${e.at}-${i}`}>
          <span style={{ ...ui.muted, ...ui.mono, fontSize: 12 }}>{clock(e.at)}</span> {e.message}
          <span style={{ ...ui.muted, fontSize: 12 }}>（{e.teacher.displayName}）</span>
        </li>
      ))}
    </ol>
  );
}
