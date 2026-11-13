// PROTOTYPE — 版本 C「迷你月曆＋即時動態」：左小月曆選日，中間「時段×教室」矩陣，右邊學生 agent 的預約動態。
import { useState } from 'react'
import {
  buildCalendarMonth,
  dayExpandSlots,
  landingYearMonth,
  roomsOnBoard,
  shiftYearMonth,
  weekdayIndexSundayFirst,
} from '../../teacher/calendarBoard.ts'
import { SESSION_ID, formatTime, shortDate, type DemoBoard } from './demoBoard.ts'
import { LiveDot, RoomChip } from './shared.tsx'

export const name = '迷你月曆＋即時動態'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function VariantC({ board }: { board: DemoBoard }) {
  const { slots, events } = board
  const [ym, setYm] = useState(() => landingYearMonth(slots, new Date()))
  const [selected, setSelected] = useState<string>(() => slots[0]?.date ?? '')
  const month = buildCalendarMonth(slots, ym)
  const rooms = roomsOnBoard(slots)
  const blanks = weekdayIndexSundayFirst(month.days[0].date)
  const day = dayExpandSlots(slots, selected)
  const times = [...new Set(day.map((s) => `${s.start}–${s.end}`))]
  const dayRooms = rooms.filter((r) => day.some((s) => s.room === r))
  const booked = slots.filter((s) => s.status === 'booked').length

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
                  onClick={() => setSelected(d.date)}
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
      </aside>

      <main className="pc-main">
        <div className="pc-main-head">
          <h2>{selected ? shortDate(selected) : '選一天'}</h2>
          <LiveDot text={`更新於 ${formatTime(board.updatedAt)}`} />
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
                      return (
                        <td
                          key={r}
                          className={`pc-cell pc-cell-${s.status}`}
                          style={{ ['--chip' as string]: `var(--room-${rooms.indexOf(r) % 8})` }}
                        >
                          {s.status === 'open' ? '可借' : s.booked_by}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <aside className="pc-right">
        <h2 className="pc-feed-title">即時動態</h2>
        <p className="p-muted pc-feed-desc">學生 agent 的預約與取消，最新在上。</p>
        {events.length === 0 ? <p className="p-muted">等待第一筆預約…</p> : null}
        <ol className="pc-feed">
          {events.map((e, i) => (
            <li key={e.id} className={i === 0 ? 'pc-feed-new' : ''}>
              <span className={`pc-feed-mark ${e.kind === 'booked' ? 'pc-mark-book' : 'pc-mark-cancel'}`} aria-hidden="true" />
              <div>
                <div>
                  <strong className="p-mono">{e.student}</strong> {e.kind === 'booked' ? '預約了' : '取消了'}{' '}
                  <RoomChip room={e.slot.room} rooms={rooms} status={e.kind === 'booked' ? 'booked' : 'open'} />
                </div>
                <div className="p-muted pc-feed-meta">
                  {shortDate(e.slot.date)} {e.slot.start}–{e.slot.end} · {formatTime(e.at)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  )
}
