// PROTOTYPE — 版本 A「月曆＋側欄」：月曆卡片在左，日展開表格固定在右。
import { useState } from 'react'
import {
  buildCalendarMonth,
  dayExpandSlots,
  landingYearMonth,
  roomsOnBoard,
  shiftYearMonth,
  visibleRoomChips,
  weekdayIndexSundayFirst,
} from '../../teacher/calendarBoard.ts'
import { SESSION_ID, formatTime, shortDate, type DemoBoard } from './demoBoard.ts'
import { ChipLegend, LiveDot, RoomChip, StatusBadge } from './shared.tsx'

export const name = '月曆＋側欄'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function VariantA({ board }: { board: DemoBoard }) {
  const { slots } = board
  const [ym, setYm] = useState(() => landingYearMonth(slots, new Date()))
  const [selected, setSelected] = useState<string | null>(() => slots[0]?.date ?? null)
  const month = buildCalendarMonth(slots, ym)
  const rooms = roomsOnBoard(slots)
  const blanks = weekdayIndexSundayFirst(month.days[0].date)
  const expanded = selected ? dayExpandSlots(slots, selected) : []

  return (
    <div className="pa">
      <header className="pa-header">
        <div>
          <h1 className="pa-title">社團教室出借看板</h1>
          <div className="pa-sub">
            <span className="p-badge p-badge-outline">堂課 {SESSION_ID}</span>
            <LiveDot text={`即時 · 更新於 ${formatTime(board.updatedAt)}`} />
          </div>
        </div>
        <div className="pa-nav">
          <button type="button" className="p-btn p-btn-outline" aria-label="上個月" onClick={() => setYm(shiftYearMonth(ym, -1))}>
            ‹
          </button>
          <span className="pa-month">
            {ym.year} 年 {ym.month} 月
          </span>
          <button type="button" className="p-btn p-btn-outline" aria-label="下個月" onClick={() => setYm(shiftYearMonth(ym, 1))}>
            ›
          </button>
        </div>
      </header>

      <div className="pa-body">
        <section className="p-card pa-cal" aria-label="月曆監看">
          <div className="pa-grid">
            {WEEKDAYS.map((w) => (
              <div key={w} className="pa-wd">
                {w}
              </div>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <div key={`b${i}`} />
            ))}
            {month.days.map((day) => {
              const shown = visibleRoomChips(day.chips)
              const isSel = selected === day.date
              return (
                <button
                  key={day.date}
                  type="button"
                  className={`pa-day ${day.hasSlots ? '' : 'pa-day-empty'} ${isSel ? 'pa-day-sel' : ''}`}
                  aria-pressed={isSel}
                  onClick={() => setSelected(day.date)}
                >
                  <span className="pa-num">{Number(day.date.slice(-2))}</span>
                  {day.hasSlots ? (
                    <>
                      <span className="pa-counts">
                        <span className="p-text-open">{day.openCount} 可借</span>
                        <span className="p-muted"> · </span>
                        <span>{day.bookedCount} 已借</span>
                      </span>
                      <span className="pa-chips">
                        {shown.chips.map((c) => (
                          <RoomChip key={c.room} room={c.room} rooms={rooms} status={c.status} />
                        ))}
                        {shown.overflow > 0 ? <span className="p-muted">+{shown.overflow}</span> : null}
                      </span>
                    </>
                  ) : null}
                </button>
              )
            })}
          </div>
          <div className="pa-legend">
            <ChipLegend />
          </div>
        </section>

        <aside className="p-card pa-side" aria-live="polite">
          <h2 className="pa-side-title">{selected ? shortDate(selected) : '日展開'}</h2>
          <p className="p-muted pa-side-desc">
            {selected ? `共 ${expanded.length} 格可借格` : '點選一日查看該日可借格。'}
          </p>
          {selected && expanded.length === 0 ? <p className="p-muted">這一天沒有可借格。</p> : null}
          {expanded.length > 0 ? (
            <table className="p-table">
              <thead>
                <tr>
                  <th>時段</th>
                  <th>教室</th>
                  <th>狀態</th>
                  <th>預約者</th>
                </tr>
              </thead>
              <tbody>
                {expanded.map((s) => (
                  <tr key={`${s.start}-${s.room}`}>
                    <td className="p-mono">
                      {s.start}–{s.end}
                    </td>
                    <td>
                      <RoomChip room={s.room} rooms={rooms} status={s.status} />
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="p-mono">{s.booked_by ?? <span className="p-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
