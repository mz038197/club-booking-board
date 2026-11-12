// PROTOTYPE — throwaway. 各版本共用的小元件（不共用版面）。
import type { ChipStatus } from '../../teacher/calendarBoard.ts'
import { chipStatusLabel } from '../../teacher/calendarBoard.ts'

// 教室色塊：顏色綁教室編號（--room-0..7），狀態只用邊框／填色表達（CONTEXT.md「教室色塊」）。
export function roomIndex(room: string, rooms: readonly string[]): number {
  const i = rooms.indexOf(room)
  return (i === -1 ? 0 : i) % 8
}

export function RoomChip({
  room,
  rooms,
  status,
  size = 'sm',
  label,
}: {
  room: string
  rooms: readonly string[]
  status: ChipStatus
  size?: 'sm' | 'lg'
  label?: string
}) {
  return (
    <span
      className={`p-chip p-chip-${status} p-chip-${size}`}
      style={{ ['--chip' as string]: `var(--room-${roomIndex(room, rooms)})` }}
      title={`教室 ${room}（${chipStatusLabel(status)}）`}
    >
      {label ?? room}
    </span>
  )
}

export function StatusBadge({ status }: { status: 'open' | 'booked' }) {
  return (
    <span className={`p-badge ${status === 'open' ? 'p-badge-open' : 'p-badge-booked'}`}>
      {status === 'open' ? '可借' : '已借'}
    </span>
  )
}

export function LiveDot({ text }: { text: string }) {
  return (
    <span className="p-live">
      <span className="p-live-dot" aria-hidden="true" />
      {text}
    </span>
  )
}

export function ChipLegend() {
  return (
    <span className="p-legend-status">
      <span className="p-chip p-chip-open p-chip-sm" style={{ ['--chip' as string]: 'var(--fg)' }}>
        框
      </span>
      可借
      <span className="p-chip p-chip-booked p-chip-sm" style={{ ['--chip' as string]: 'var(--fg)' }}>
        實
      </span>
      已借
      <span className="p-chip p-chip-mixed p-chip-sm" style={{ ['--chip' as string]: 'var(--fg)' }}>
        半
      </span>
      部分已借
    </span>
  )
}
