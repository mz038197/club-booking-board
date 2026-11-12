// PROTOTYPE — 版本 C2：C 的版面＋學生回饋感。
//   中間下方：全班進度格（s01–s40，第一次預約成功就亮起來，顏色＝借到的教室）
//   右欄：API 呼叫紀錄（含 409 SLOT_TAKEN、400 INVALID_SLOT 與換格重試）
//   矩陣：剛預約的格子閃一下＋上方通知卡
import { useEffect, useState } from 'react'
import {
  buildCalendarMonth,
  dayExpandSlots,
  landingYearMonth,
  roomsOnBoard,
  shiftYearMonth,
  weekdayIndexSundayFirst,
} from '../../teacher/calendarBoard.ts'
import { SESSION_ID, formatTime, shortDate, type ApiCall, type DemoBoard } from './demoBoard.ts'
import { LiveDot, RoomChip, roomIndex } from './shared.tsx'

export const name = 'C＋全班進度＋API 紀錄'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const TOAST_MS = 3000

function useLatestSuccess(calls: ApiCall[]): ApiCall | null {
  const [toast, setToast] = useState<ApiCall | null>(null)
  const latest = calls.find((c) => c.status === 201) ?? null
  const latestId = latest?.id
  useEffect(() => {
    if (!latest || Date.now() - latest.at.getTime() > TOAST_MS) return
    setToast(latest)
    const t = window.setTimeout(() => setToast((cur) => (cur?.id === latest.id ? null : cur)), TOAST_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestId])
  return toast
}

export function VariantC2({ board }: { board: DemoBoard }) {
  const { slots, calls, roster, achieved } = board
  const [ym, setYm] = useState(() => landingYearMonth(slots, new Date()))
  const [selected, setSelected] = useState<string>(() => slots[0]?.date ?? '')
  const [follow, setFollow] = useState(true)
  const toast = useLatestSuccess(calls)

  // 「跟隨」：有人預約成功就自動跳到那一天，讓全班看到格子亮起來
  useEffect(() => {
    if (follow && toast?.slot) setSelected(toast.slot.date)
  }, [follow, toast])

  const month = buildCalendarMonth(slots, ym)
  const rooms = roomsOnBoard(slots)
  const blanks = weekdayIndexSundayFirst(month.days[0].date)
  const day = dayExpandSlots(slots, selected)
  const times = [...new Set(day.map((s) => `${s.start}–${s.end}`))]
  const dayRooms = rooms.filter((r) => day.some((s) => s.room === r))
  const booked = slots.filter((s) => s.status === 'booked').length
  const doneCount = Object.keys(achieved).length
  const first = Object.entries(achieved).find(([, a]) => a.order === 1)?.[0]

  return (
    <div className="pc">
      <aside className="pc-left">
        <div className="pc-brand">
          <h1>教室出借看板</h1>
          <span className="p-badge p-badge-outline">{SESSION_ID}</span>
        </div>
        <div className="p-card pc-mini">
          <div className="pc-mini-head">
            <button type="button" className="p-btn p-btn-ghost p-btn-icon" aria-label="上個月" onClick={() => setYm(shiftYearMonth(ym, -1))}>
              ‹
            </button>
            <span>
              {ym.year} 年 {ym.month} 月
            </span>
            <button type="button" className="p-btn p-btn-ghost p-btn-icon" aria-label="下個月" onClick={() => setYm(shiftYearMonth(ym, 1))}>
              ›
            </button>
          </div>
          <div className="pc-mini-grid">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pc-wd">
                {w}
              </span>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {month.days.map((d) => {
              const full = d.hasSlots && d.openCount === 0
              return (
                <button
                  key={d.date}
                  type="button"
                  className={`pc-mday ${d.date === selected ? 'pc-mday-sel' : ''} ${d.hasSlots ? '' : 'pc-mday-empty'}`}
                  onClick={() => {
                    setSelected(d.date)
                    setFollow(false)
                  }}
                  aria-pressed={d.date === selected}
                  aria-label={`${d.date} 可借 ${d.openCount}，已借 ${d.bookedCount}`}
                >
                  {Number(d.date.slice(-2))}
                  {d.hasSlots ? <span className={`pc-dot ${full ? 'pc-dot-full' : ''}`} aria-hidden="true" /> : null}
                </button>
              )
            })}
          </div>
          <p className="p-muted pc-mini-foot">● 有可借格　○ 已借滿</p>
        </div>
        <div className="p-card pc-totals">
          <div>
            <span className="p-muted">全部可借格</span>
            <strong>{slots.length}</strong>
          </div>
          <div>
            <span className="p-muted">已借</span>
            <strong>{booked}</strong>
          </div>
        </div>
        <label className="pc2-follow">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          有人預約時自動跳到那一天
        </label>
      </aside>

      <main className="pc-main">
        <div className="pc-main-head">
          <h2>{selected ? shortDate(selected) : '選一天'}</h2>
          <LiveDot text={`更新於 ${formatTime(board.updatedAt)}`} />
        </div>

        <div className="pc2-toast-slot" aria-live="polite">
          {toast?.slot ? (
            <div key={toast.id} className="pc2-toast">
              <span className="pc2-toast-icon" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong className="p-mono">{toast.student}</strong> 成功預約{' '}
                <RoomChip room={toast.slot.room} rooms={rooms} status="booked" /> {shortDate(toast.slot.date)}{' '}
                {toast.slot.start}–{toast.slot.end}
                {toast.retry ? <span className="pc2-tag">換格後成功</span> : null}
              </span>
            </div>
          ) : null}
        </div>

        {day.length === 0 ? (
          <div className="p-card pc-empty p-muted">這一天沒有可借格。</div>
        ) : (
          <div className="p-card pc-matrix-wrap">
            <table className="pc-matrix">
              <thead>
                <tr>
                  <th>時段</th>
                  {dayRooms.map((r) => (
                    <th key={r}>
                      <RoomChip room={r} rooms={rooms} status="booked" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {times.map((t) => (
                  <tr key={t}>
                    <th className="p-mono">{t}</th>
                    {dayRooms.map((r) => {
                      const s = day.find((x) => `${x.start}–${x.end}` === t && x.room === r)
                      if (!s) return <td key={r} className="pc-cell pc-cell-none">—</td>
                      const isNew = toast?.slot?.date === selected && toast.slot.start === s.start && toast.slot.room === s.room
                      return (
                        <td
                          key={isNew ? `${r}-${toast?.id}` : r}
                          className={`pc-cell pc-cell-${s.status} ${isNew ? 'pc2-flash' : ''}`}
                          style={{ ['--chip' as string]: `var(--room-${roomIndex(r, rooms)})` }}
                        >
                          {s.status === 'open' ? '可借' : s.booked_by}
                          {isNew ? <span className="pc2-new">剛預約！</span> : null}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <section className="p-card pc2-roster" aria-label="全班進度">
          <div className="pc2-roster-head">
            <h3>全班進度</h3>
            <span className="pc2-roster-count">
              已完成 <strong>{doneCount}</strong> / {roster.length} 人
            </span>
          </div>
          <div className="pc2-progress" aria-hidden="true">
            <span style={{ width: `${(doneCount / roster.length) * 100}%` }} />
          </div>
          <ol className="pc2-tiles">
            {roster.map((sid) => {
              const a = achieved[sid]
              return (
                <li
                  key={a ? `${sid}-done` : sid}
                  className={`pc2-tile ${a ? 'pc2-tile-done' : ''}`}
                  style={a ? { ['--chip' as string]: `var(--room-${roomIndex(a.room, rooms)})` } : undefined}
                  title={a ? `${sid}：第 ${a.order} 位完成，借到 ${a.room}（${formatTime(a.at)}）` : `${sid}：尚未預約成功`}
                >
                  <span className="pc2-tile-id">{sid}</span>
                  <span className="pc2-tile-sub">{a ? a.room : '—'}</span>
                  {sid === first ? <span className="pc2-first">首位</span> : null}
                </li>
              )
            })}
          </ol>
        </section>
      </main>

      <aside className="pc-right">
        <h2 className="pc-feed-title">API 呼叫紀錄</h2>
        <p className="p-muted pc-feed-desc">每個學生 agent 打來的請求，成功與失敗都會列出，最新在上。</p>
        {calls.length === 0 ? <p className="p-muted">等待第一個請求…</p> : null}
        <ol className="pc2-log">
          {calls.map((c, i) => (
            <li key={c.id} className={`pc2-log-row ${i === 0 ? 'pc2-log-new' : ''}`}>
              <div className="pc2-log-line">
                <span className="p-muted">{formatTime(c.at)}</span>
                <strong>{c.student}</strong>
                <span>{c.method}</span>
                <span className={`pc2-status pc2-status-${c.status}`}>{c.status}</span>
                {c.code ? <span className={`pc2-status pc2-status-${c.status}`}>{c.code}</span> : null}
              </div>
              <div className="pc2-log-detail">
                {c.slot ? (
                  <>
                    <RoomChip room={c.slot.room} rooms={rooms} status={c.status === 201 ? 'booked' : 'open'} /> {shortDate(c.slot.date)}{' '}
                    {c.slot.start}
                  </>
                ) : (
                  <span className="p-mono">{c.slotId}</span>
                )}
                {c.note ? <span className="p-muted"> · {c.note}</span> : null}
                {c.retry ? <span className="pc2-tag">↻ 換格重試</span> : null}
                {c.method === 'DELETE' ? <span className="p-muted"> · 取消預約</span> : null}
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  )
}
