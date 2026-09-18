import type { BoardSlot } from '../api/types.ts'
import { buildBoardGrid, cellKey } from './groupSlots.ts'

type BoardGridProps = {
  slots: BoardSlot[]
}

export function BoardGrid({ slots }: BoardGridProps) {
  if (slots.length === 0) {
    return <p className="empty-board">這一堂課尚未設定可借教室。</p>
  }

  const grid = buildBoardGrid(slots)

  return (
    <div className="board-dates">
      {grid.dates.map((date) => (
        <section key={date} className="date-block">
          <h2 className="date-heading">{date}</h2>
          <div className="table-wrap">
            <table className="timetable">
              <thead>
                <tr>
                  <th scope="col">時段</th>
                  {grid.rooms.map((room) => (
                    <th key={room} scope="col">
                      教室 {room}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.bands.map((band) => (
                  <tr key={`${band.start}-${band.end}`}>
                    <th scope="row">
                      {band.start}–{band.end}
                    </th>
                    {grid.rooms.map((room) => {
                      const slot = grid.lookup.get(cellKey(date, band, room))
                      if (!slot) {
                        return (
                          <td key={room} className="cell cell-empty">
                            —
                          </td>
                        )
                      }
                      if (slot.status === 'booked') {
                        return (
                          <td key={room} className="cell cell-booked">
                            <span className="cell-status">已預約</span>
                            <span className="cell-who">{slot.booked_by ?? '（未標示預約者）'}</span>
                          </td>
                        )
                      }
                      return (
                        <td key={room} className="cell cell-open">
                          <span className="cell-status">可借</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
