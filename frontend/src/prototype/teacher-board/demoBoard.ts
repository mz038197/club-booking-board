// PROTOTYPE — throwaway. 記憶體內的模擬堂課資料＋模擬學生 agent 呼叫 API（含失敗與重試）。不接後端。
import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardSlot } from '../../api/types.ts'
import { formatSlotId } from '../../board/slotId.ts'

export const SESSION_ID = 'tn1-1209'

export type BoardEvent = {
  id: number
  at: Date
  kind: 'booked' | 'cancelled'
  slot: BoardSlot
  student: string
}

// 模擬「後端記錄每一次請求」——正式版需要新的 activity 端點，目前 API 沒有。
export type ApiCall = {
  id: number
  at: Date
  student: string
  method: 'POST' | 'DELETE'
  path: string
  status: 201 | 204 | 400 | 409
  code?: 'SLOT_TAKEN' | 'INVALID_SLOT'
  slot?: BoardSlot
  slotId: string
  note?: string
  retry?: boolean
}

export type Achievement = { room: string; at: Date; order: number }

export type DemoBoard = {
  slots: BoardSlot[]
  events: BoardEvent[]
  calls: ApiCall[]
  roster: string[]
  achieved: Record<string, Achievement>
  updatedAt: Date
  auto: boolean
  setAuto: (next: boolean) => void
  step: () => void
  reset: () => void
}

const DATES = [
  '2026-12-10',
  '2026-12-11',
  '2026-12-14',
  '2026-12-15',
  '2026-12-17',
  '2026-12-18',
  '2026-12-21',
  '2026-12-22',
]
const TIMES: [string, string][] = [
  ['12:10', '13:00'],
  ['16:10', '17:30'],
]
const ROOMS = ['301', '302', '303', '304', '401', '402']
export const ROSTER = Array.from({ length: 40 }, (_, i) => student(i + 1))

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function student(n: number): string {
  return `s${String(n).padStart(2, '0')}`
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

// 開場：有可借格，少量預約，讓「全班進度」從低處開始長。
function seedSlots(): BoardSlot[] {
  const rand = rng(1209)
  const slots: BoardSlot[] = []
  for (const date of DATES) {
    for (const [start, end] of TIMES) {
      for (const room of ROOMS) {
        if (rand() < 0.45) continue
        const spec = { date, start, end, room }
        slots.push({ ...spec, slot_id: formatSlotId(spec), status: 'open' })
      }
    }
  }
  return slots
}

export function useDemoBoard(): DemoBoard {
  const [slots, setSlots] = useState<BoardSlot[]>(seedSlots)
  const [events, setEvents] = useState<BoardEvent[]>([])
  const [calls, setCalls] = useState<ApiCall[]>([])
  const [achieved, setAchieved] = useState<Record<string, Achievement>>({})
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const [auto, setAuto] = useState(true)
  const nextId = useRef(1)
  const slotsRef = useRef(slots)
  const achievedRef = useRef(achieved)

  const step = useCallback(() => {
    let current = slotsRef.current
    const ach = { ...achievedRef.current }
    const newCalls: ApiCall[] = []
    const newEvents: BoardEvent[] = []
    const now = () => new Date()
    const open = () => current.filter((s) => s.status === 'open')
    const booked = () => current.filter((s) => s.status === 'booked')
    const pending = ROSTER.filter((s) => !ach[s])

    const book = (who: string, target: BoardSlot, retry = false) => {
      const next: BoardSlot = { ...target, status: 'booked', booked_by: who }
      current = current.map((s) => (s.slot_id === target.slot_id ? next : s))
      newCalls.push({ id: nextId.current++, at: now(), student: who, method: 'POST', path: '/bookings', status: 201, slot: next, slotId: next.slot_id, retry })
      newEvents.push({ id: nextId.current++, at: now(), kind: 'booked', slot: next, student: who })
      if (!ach[who]) ach[who] = { room: next.room, at: now(), order: Object.keys(ach).length + 1 }
    }

    const roll = Math.random()
    const who = pending.length > 0 && Math.random() < 0.75 ? pick(pending) : pick(ROSTER)

    if (roll < 0.18 && booked().length > 0 && open().length > 0) {
      // 搶已被借走的格子 → 409，接著 agent 換同日（或其他日）空檔重試
      const taken = pick(booked())
      newCalls.push({
        id: nextId.current++, at: now(), student: who, method: 'POST', path: '/bookings', status: 409,
        code: 'SLOT_TAKEN', slot: taken, slotId: taken.slot_id, note: `已被 ${taken.booked_by} 預約`,
      })
      const sameDay = open().filter((s) => s.date === taken.date)
      book(who, pick(sameDay.length > 0 ? sameDay : open()), true)
    } else if (roll < 0.26) {
      // 不存在的格子（例如週末）→ 400
      const fake = `2026-12-13_12:10-13:00_${pick(ROOMS)}`
      newCalls.push({ id: nextId.current++, at: now(), student: who, method: 'POST', path: '/bookings', status: 400, code: 'INVALID_SLOT', slotId: fake, note: '這一格不在可借清單' })
    } else if (roll < 0.36 && booked().length > 0) {
      const target = pick(booked())
      const owner = target.booked_by ?? '?'
      const next: BoardSlot = { slot_id: target.slot_id, date: target.date, start: target.start, end: target.end, room: target.room, status: 'open' }
      current = current.map((s) => (s.slot_id === target.slot_id ? next : s))
      newCalls.push({ id: nextId.current++, at: now(), student: owner, method: 'DELETE', path: '/bookings/{id}', status: 204, slot: target, slotId: target.slot_id })
      newEvents.push({ id: nextId.current++, at: now(), kind: 'cancelled', slot: next, student: owner })
    } else if (open().length > 0) {
      book(who, pick(open()))
    } else {
      return
    }

    slotsRef.current = current
    achievedRef.current = ach
    setSlots(current)
    setAchieved(ach)
    setCalls((prev) => [...newCalls.reverse(), ...prev].slice(0, 60))
    setEvents((prev) => [...newEvents.reverse(), ...prev].slice(0, 30))
    setUpdatedAt(new Date())
  }, [])

  const reset = useCallback(() => {
    const fresh = seedSlots()
    slotsRef.current = fresh
    achievedRef.current = {}
    setSlots(fresh)
    setAchieved({})
    setCalls([])
    setEvents([])
    setUpdatedAt(new Date())
  }, [])

  useEffect(() => {
    if (!auto) return
    const timer = window.setInterval(step, 3000)
    return () => window.clearInterval(timer)
  }, [auto, step])

  return { slots, events, calls, roster: ROSTER, achieved, updatedAt, auto, setAuto, step, reset }
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString('zh-Hant', { hour12: false })
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  const wd = '日一二三四五六'[new Date(iso + 'T00:00:00').getDay()]
  return `${m}/${d}（${wd}）`
}
