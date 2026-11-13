// PROTOTYPE — 版本 B「投影大字」：整面月曆＋頂部總數，點日從底部滑出明細。為教室後排可讀而放大。
import { useEffect, useState } from 'react'
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
import { LiveDot, RoomChip } from './shared.tsx'

export const name = '投影大字'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function VariantB({ board }: { board: DemoBoard }) {
  const { slots } = board
  const [ym, setYm] = useState(() => landingYearMonth(slots, new Date()))
  const [selected, setSelected] = useState<string | null>(null)
  const month = buildCalendarMonth(slots, ym)
  const rooms = roomsOnBoard(slots)
  const blanks = weekdayIndexSundayFirst(month.days[0].date)
  const total = slots.length
  const booked = slots.filter((s) => s.status === 'booked').length
  const rate = total === 0 ? 0 : Math.round((booked / total) * 100)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const expanded = selected ? dayExpandSlots(slots, selected) : []
  const byTime = new Map<string, typeof expanded>()
  for (const s of expanded) {
    const k = `${s.start}–${s.end}`
    byTime.set(k, [...(byTime.get(k) ?? []), s])
  }

  return (
    <div className="pb">
      <header className="pb-header">
        <div className="pb-head-left">
          <h1 className="pb-title">
            {ym.year} 年 {ym.month} 月
          </h1>
          <div className="pb-nav">
            <button type="button" className="p-btn p-btn-ghost" onClick={() => setYm(shiftYearMonth(ym, -1))}>
              ‹ 上個月
            </button>
            <button type="button" className="p-btn p-btn-ghost" onClick={() => setYm(shiftYearMonth(ym, 1))}>
              下個月 ›
            </button>
          </div>
        </div>
        <dl className="pb-kpis">
          <div>
            <dt>可借</dt>
            <dd className="p-text-open">{total - booked}</dd>
          </div>
          <div>
            <dt>已借</dt>
            <dd>{booked}</dd>
          </div>
          <div>
            <dt>預約率</dt>
            <dd>{rate}%</dd>
          </div>
        </dl>
      </header>

      <div className="pb-strip">
        <span className="pb-session">堂課 {SESSION_ID}</span>
        <span className="pb-rooms">
          {rooms.map((r) => (
            <RoomChip key={r} room={r} rooms={rooms} status="booked" />
          ))}
        </span>
        <LiveDot text={formatTime(board.updatedAt)} />
      </div>

      <div className="pb-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-wd">
            {w}
          </div>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {month.days.map((day) => {
          const n = day.openCount + day.bookedCount
          const shown = visibleRoomChips(day.chips)
          return (
            <button
              key={day.date}
              type="button"
              className={`pb-day ${day.hasSlots ? '' : 'pb-day-empty'} ${selected === day.date ? 'pb-day-sel' : ''}`}
              disabled={!day.hasSlots}
              onClick={() => setSelected(day.date)}
              aria-label={`${day.date} 可借 ${day.openCount}，已借 ${day.bookedCount}`}
            >
              <span className="pb-num">{Number(day.date.slice(-2))}</span>
              {day.hasSlots ? (
                <>
                  <span className="pb-ratio">
                    <strong>{day.bookedCount}</strong>
                    <span className="p-muted"> / {n} 已借</span>
                  </span>
                  <span className="pb-bar" aria-hidden="true">
                    <span style={{ width: `${(day.bookedCount / n) * 100}%` }} />
                  </span>
                  <span className="pb-chips">
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

      {selected ? (
        <>
          <div className="pb-scrim" onClick={() => setSelected(null)} />
          <section className="pb-sheet" role="dialog" aria-label={`${selected} 日展開`}>
            <div className="pb-sheet-head">
              <h2>{shortDate(selected)}</h2>
              <button type="button" className="p-btn p-btn-outline" onClick={() => setSelected(null)}>
                關閉（Esc）
              </button>
            </div>
            {[...byTime.entries()].map(([time, list]) => (
              <div key={time} className="pb-row">
                <span className="pb-time p-mono">{time}</span>
                <span className="pb-row-chips">
                  {list.map((s) => (
                    <span key={s.room} className="pb-cellcard">
                      <RoomChip room={s.room} rooms={rooms} status={s.status} size="lg" />
                      <span className={s.status === 'open' ? 'p-text-open' : 'p-mono'}>
                        {s.status === 'open' ? '可借' : s.booked_by}
                      </span>
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </div>
  )
}
