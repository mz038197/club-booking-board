import type { BoardSlot } from '../api/types.ts'
import {
  buildCalendarMonth,
  chipStatusLabel,
  dayExpandSlots,
  formatYearMonth,
  roomChipColor,
  roomsOnBoard,
  shiftYearMonth,
  slotStatusLabel,
  visibleRoomChips,
  weekdayIndexSundayFirst,
  type YearMonth,
} from './calendarBoard.ts'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

type CalendarBoardProps = {
  slots: BoardSlot[]
  yearMonth: YearMonth
  onYearMonthChange: (next: YearMonth) => void
  selectedDate: string | null
  onSelectDate: (date: string) => void
}

export function CalendarBoard({
  slots,
  yearMonth,
  onYearMonthChange,
  selectedDate,
  onSelectDate,
}: CalendarBoardProps) {
  const month = buildCalendarMonth(slots, yearMonth)
  const leadingBlanks = weekdayIndexSundayFirst(month.days[0].date)
  const expanded = selectedDate ? dayExpandSlots(slots, selectedDate) : []
  const boardRooms = roomsOnBoard(slots)

  return (
    <section className="calendar-board" aria-label="月曆監看">
      <div className="calendar-toolbar">
        <h2>
          月曆監看　{yearMonth.year}年{yearMonth.month}月
        </h2>
        <div className="calendar-nav">
          <button
            type="button"
            className="btn"
            onClick={() => onYearMonthChange(shiftYearMonth(yearMonth, -1))}
          >
            上個月
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => onYearMonthChange(shiftYearMonth(yearMonth, 1))}
          >
            下個月
          </button>
        </div>
      </div>

      <div className="calendar-layout">
        <div className="month-grid" role="grid" aria-label={`${formatYearMonth(yearMonth)} 月曆`}>
          {WEEKDAYS.map((label) => (
            <div key={label} className="weekday" role="columnheader">
              {label}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, index) => (
            <div key={`blank-${index}`} className="day-cell day-blank" role="gridcell" />
          ))}
          {month.days.map((day) => {
            const shown = visibleRoomChips(day.chips)
            const selected = selectedDate === day.date
            return (
              <button
                key={day.date}
                type="button"
                role="gridcell"
                className={`day-cell ${day.hasSlots ? 'has-slots' : 'no-slots'} ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                aria-label={`${day.date} 可借 ${day.openCount}／已借 ${day.bookedCount}`}
                onClick={() => onSelectDate(day.date)}
              >
                <span className="day-num">{Number(day.date.slice(-2))}</span>
                <span className="day-counts">
                  可借 {day.openCount}／已借 {day.bookedCount}
                </span>
                {day.hasSlots ? (
                  <span className="chip-row">
                    {shown.chips.map((chip, index) => (
                      <span
                        key={`${day.date}-${chip.room}-${chip.status}-${index}`}
                        className={`room-chip ${chip.status}`}
                        style={{ backgroundColor: roomChipColor(chip.room, boardRooms) }}
                        title={`教室 ${chip.room}（${chipStatusLabel(chip.status)}）`}
                      >
                        {chip.room}
                      </span>
                    ))}
                    {shown.overflow > 0 ? <span className="chip-more">+{shown.overflow}</span> : null}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        <aside className="day-expand" aria-live="polite">
          {selectedDate ? (
            <>
              <h3>日展開　{selectedDate}</h3>
              {expanded.length === 0 ? (
                <p className="muted">這一天沒有可借格。</p>
              ) : (
                <ul className="expand-list">
                  {expanded.map((slot) => (
                    <li key={`${slot.start}-${slot.end}-${slot.room}`}>
                      <span className="expand-time">
                        {slot.start}–{slot.end}
                      </span>
                      <span
                        className={`room-chip ${slot.status}`}
                        style={{ backgroundColor: roomChipColor(slot.room, boardRooms) }}
                      >
                        {slot.room}
                      </span>
                      <span className={`expand-status ${slot.status}`}>{slotStatusLabel(slot.status)}</span>
                      {slot.status === 'booked' ? (
                        <span className="expand-who">{slot.booked_by ?? '（未標示預約者）'}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <h3>日展開</h3>
              <p className="muted">點選一日查看該日可借格。</p>
            </>
          )}
        </aside>
      </div>
    </section>
  )
}
