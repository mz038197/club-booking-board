// PROTOTYPE — throwaway. 管理後台的記憶體狀態，照 ADR 0003–0005：
// 老師以 router Google 登入、堂課掛在 router 班級下、每班一個目前堂課、沒有開放開關只有暫停、
// 名冊來自 Key Check（呼叫過才出現）、學生用分享連結看唯讀看板。不接後端。
import { useCallback, useState } from 'react'
import type { BoardSlot } from '../../api/types.ts'
import { formatSlotId } from '../../board/slotId.ts'

export type Rules = { maxPerStudent: number; windowStart: string; windowEnd: string }
export type Display = { maskNames: boolean; follow: boolean }
export type ShareLink = { token: string; expiresAt: Date }
/** Key Check 回傳的學生：id + 顯示名稱。第一次呼叫時才出現。 */
export type SeenStudent = { id: number; name: string; firstSeen: Date }
/** router 告訴後台：這位老師擁有的班級。 */
export type RouterClass = { id: number; name: string }

export type AdminSession = {
  id: string
  classId: number
  title: string
  paused: boolean
  rules: Rules
  display: Display
  share: ShareLink | null
  students: SeenStudent[]
  slots: BoardSlot[]
}

export type AdminLog = { id: number; at: Date; text: string; tone: 'ok' | 'warn' | 'error' }

export type SlotDraft = { dates: string[]; times: [string, string][]; rooms: string[] }

export const TEACHER = { name: '王老師' }
export const ROUTER_URL = 'https://ai.vanscoding.com'
export const API_BASE_URL = 'https://club-booking.vercel.app/api'
export const MCP_URL = 'https://mcp.vanscoding.com/mcp'
export const SHARE_BASE_URL = 'https://club-booking.vercel.app/view'
export const SHARE_HOURS = 12
export const PRESET_TIMES: [string, string][] = [
  ['12:10', '13:00'],
  ['16:10', '17:30'],
  ['13:10', '15:00'],
]
export const PRESET_ROOMS = ['301', '302', '303', '304', '401', '402', '501', '實驗室A']

const CLASSES: RouterClass[] = [
  { id: 5, name: '台南一中 AI 社' },
  { id: 8, name: '台南一中 資訊研究社' },
]

function newToken(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 22 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function makeSlots(draft: SlotDraft): BoardSlot[] {
  const out: BoardSlot[] = []
  for (const date of draft.dates)
    for (const [start, end] of draft.times)
      for (const room of draft.rooms) {
        const spec = { date, start, end, room }
        out.push({ ...spec, slot_id: formatSlotId(spec), status: 'open' })
      }
  return out
}

const NAMES = ['07王小明', '12林佳穎', '03陳柏宇', '21黃子晴', '15張家豪', '09李沛恩', '30吳承翰', '18蔡宜庭']

function seed(): AdminSession[] {
  const now = Date.now()
  const students: SeenStudent[] = NAMES.map((name, i) => ({ id: 1200 + i, name, firstSeen: new Date(now - (NAMES.length - i) * 60_000) }))
  const slots = makeSlots({
    dates: ['2026-12-10', '2026-12-11', '2026-12-14', '2026-12-15'],
    times: PRESET_TIMES.slice(0, 2),
    rooms: ['301', '302', '303', '304'],
  }).map((s, i) => (i % 5 === 1 ? { ...s, status: 'booked' as const, booked_by: students[Math.floor(i / 5) % students.length].name } : s))
  return [
    {
      id: 'ai-1209',
      classId: 5,
      title: '12/09 Agent Builder（一）',
      paused: false,
      rules: { maxPerStudent: 1, windowStart: '13:50', windowEnd: '15:10' },
      display: { maskNames: false, follow: true },
      share: { token: newToken(), expiresAt: new Date(now + SHARE_HOURS * 3600_000) },
      students,
      slots,
    },
    {
      id: 'ai-1216',
      classId: 5,
      title: '12/16 Agent Builder（二）',
      paused: false,
      rules: { maxPerStudent: 2, windowStart: '12:30', windowEnd: '15:10' },
      display: { maskNames: false, follow: true },
      share: null,
      students: [],
      slots: [],
    },
  ]
}

export function useDemoAdmin() {
  const [sessions, setSessions] = useState<AdminSession[]>(seed)
  const [classId, setClassId] = useState(CLASSES[0].id)
  /** 每個班級的目前堂課。 */
  const [currentByClass, setCurrentByClass] = useState<Record<number, string>>({ 5: 'ai-1209' })
  /** 後台正在看的堂課（預設為目前堂課，可切去看舊的）。 */
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [logs, setLogs] = useState<AdminLog[]>([])

  const classSessions = sessions.filter((s) => s.classId === classId)
  const currentId = currentByClass[classId]
  const viewing = classSessions.find((s) => s.id === viewingId) ?? classSessions.find((s) => s.id === currentId) ?? classSessions[0] ?? null

  const log = useCallback((text: string, tone: AdminLog['tone'] = 'ok') => {
    setLogs((prev) => [{ id: Date.now() + Math.random(), at: new Date(), text, tone }, ...prev].slice(0, 20))
  }, [])

  const patch = (fn: (s: AdminSession) => AdminSession) =>
    viewing && setSessions((all) => all.map((s) => (s.id === viewing.id ? fn(s) : s)))

  return {
    teacher: TEACHER,
    classes: CLASSES,
    classId,
    classSessions,
    currentId,
    current: viewing,
    logs,
    selectClass(id: number) {
      setClassId(id)
      setViewingId(null)
    },
    view: (id: string) => setViewingId(id),
    makeCurrent(id: string) {
      setCurrentByClass((m) => ({ ...m, [classId]: id }))
      log(`目前堂課改為 ${id}：學生的 Agent 之後都進這一堂`, 'warn')
    },
    createSession(id: string, title: string, copyFrom?: string) {
      if (!id.trim() || sessions.some((s) => s.id === id)) {
        log(`堂課代號「${id}」空白或已存在`, 'error')
        return false
      }
      const src = sessions.find((s) => s.id === copyFrom)
      const fresh: AdminSession = {
        id,
        classId,
        title: title || id,
        paused: false,
        rules: src ? { ...src.rules } : { maxPerStudent: 1, windowStart: '12:30', windowEnd: '15:10' },
        display: src ? { ...src.display } : { maskNames: false, follow: true },
        share: null,
        students: [],
        slots: src ? src.slots.map(({ slot_id, date, start, end, room }) => ({ slot_id, date, start, end, room, status: 'open' as const })) : [],
      }
      setSessions((all) => [...all, fresh])
      setCurrentByClass((m) => ({ ...m, [classId]: id }))
      setViewingId(id)
      log(src ? `建立堂課 ${id}（複製自 ${src.id}，不含預約），已成為目前堂課` : `建立堂課 ${id}，已成為目前堂課`)
      return true
    },
    setPaused(paused: boolean) {
      patch((s) => ({ ...s, paused }))
      log(paused ? '已暫停預約：學生 Agent 預約／取消會收到 403 BOOKING_CLOSED，查詢照常' : '已恢復預約', paused ? 'warn' : 'ok')
    },
    addSlots(draft: SlotDraft) {
      if (!viewing) return
      const incoming = makeSlots(draft)
      const have = new Set(viewing.slots.map((s) => s.slot_id))
      const added = incoming.filter((s) => !have.has(s.slot_id))
      patch((s) => ({ ...s, slots: [...s.slots, ...added].sort((a, b) => a.slot_id.localeCompare(b.slot_id)) }))
      log(`新增 ${added.length} 格可借格${incoming.length - added.length ? `（略過重複 ${incoming.length - added.length} 格）` : ''}`)
    },
    removeSlot(slotId: string) {
      const slot = viewing?.slots.find((s) => s.slot_id === slotId)
      if (slot?.status === 'booked') {
        log(`無法移除 ${slotId}：已被 ${slot.booked_by} 預約（先強制取消）`, 'error')
        return
      }
      patch((s) => ({ ...s, slots: s.slots.filter((x) => x.slot_id !== slotId) }))
      log(`移除可借格 ${slotId}`)
    },
    forceCancel(slotId: string) {
      const slot = viewing?.slots.find((s) => s.slot_id === slotId)
      patch((s) => ({
        ...s,
        slots: s.slots.map((x) =>
          x.slot_id === slotId ? { slot_id: x.slot_id, date: x.date, start: x.start, end: x.end, room: x.room, status: 'open' as const } : x,
        ),
      }))
      log(`老師強制取消 ${slot?.booked_by ?? ''} 的預約 ${slotId}`, 'warn')
    },
    setRules(rules: Rules) {
      patch((s) => ({ ...s, rules }))
      log(`規則：每人最多 ${rules.maxPerStudent} 格，${rules.windowStart}–${rules.windowEnd} 可預約`)
    },
    setDisplay(display: Display) {
      patch((s) => ({ ...s, display }))
      log(`投影：${display.maskNames ? '遮蔽名稱' : '顯示名稱'}、${display.follow ? '自動跳日' : '不自動跳日'}`)
    },
    makeShare() {
      const had = Boolean(viewing?.share)
      patch((s) => ({ ...s, share: { token: newToken(), expiresAt: new Date(Date.now() + SHARE_HOURS * 3600_000) } }))
      log(had ? '已重新產生分享連結：舊連結立即失效' : `已產生分享連結（${SHARE_HOURS} 小時後失效）`, had ? 'warn' : 'ok')
    },
    closeShare() {
      patch((s) => ({ ...s, share: null }))
      log('已關閉分享連結', 'warn')
    },
    resetSession() {
      patch((s) => ({
        ...s,
        slots: s.slots.map(({ slot_id, date, start, end, room }) => ({ slot_id, date, start, end, room, status: 'open' as const })),
      }))
      log(`已重置 ${viewing?.id}：清空全部預約與 API 紀錄（可借清單保留）`, 'warn')
    },
  }
}

export type DemoAdmin = ReturnType<typeof useDemoAdmin>
