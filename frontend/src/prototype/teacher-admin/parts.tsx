// PROTOTYPE — throwaway. 管理後台的小元件（照 ADR 0003–0005）。
import { useEffect, useState } from 'react'
import { roomsOnBoard } from '../../teacher/calendarBoard.ts'
import { RoomChip } from '../teacher-board/shared.tsx'
import { shortDate } from '../teacher-board/demoBoard.ts'
import {
  API_BASE_URL,
  MCP_URL,
  PRESET_ROOMS,
  PRESET_TIMES,
  ROUTER_URL,
  SHARE_BASE_URL,
  SHARE_HOURS,
  makeSlots,
  type AdminSession,
  type DemoAdmin,
  type SlotDraft,
} from './demoAdmin.ts'

type P = { admin: DemoAdmin; s: AdminSession }

/** 兩段式確認：第一次按顯示「確定？」，3 秒內再按才執行（不用 window.confirm）。 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = 'p-btn p-btn-outline',
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
  className?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 3000)
    return () => window.clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={`${className} ${armed ? 'ad-danger' : ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  return {
    copied,
    copy(label: string, value: string) {
      void navigator.clipboard?.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(null), 1500)
    },
  }
}

/** 暫停是緊急煞車：預設沒暫停；能不能預約平常跟著學生金鑰的時效走。 */
export function PauseSwitch({ admin, s, size = 'md' }: P & { size?: 'md' | 'xl' }) {
  const running = !s.paused
  return (
    <button
      type="button"
      role="switch"
      aria-checked={running}
      className={`ad-switch ad-switch-${size} ${running ? 'ad-switch-on' : ''}`}
      onClick={() => admin.setPaused(running)}
    >
      <span className="ad-switch-track" aria-hidden="true">
        <span className="ad-switch-thumb" />
      </span>
      <span className="ad-switch-text">
        <strong>{running ? '預約進行中' : '預約已暫停'}</strong>
        <span className="p-muted">{running ? '跟著學生金鑰時效；按一下緊急暫停' : '學生預約／取消收到 BOOKING_CLOSED；按一下恢復'}</span>
      </span>
    </button>
  )
}

export function Stats({ s }: { s: AdminSession }) {
  const booked = s.slots.filter((x) => x.status === 'booked')
  const done = new Set(booked.map((x) => x.booked_by))
  const items = [
    ['可借格', s.slots.length],
    ['已借', booked.length],
    ['已呼叫的學生', s.students.length],
    ['已預約的學生', done.size],
  ] as const
  return (
    <dl className="ad-stats">
      {items.map(([k, v]) => (
        <div key={k} className="p-card">
          <dt className="p-muted">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function toggle<T>(list: T[], item: T, eq: (a: T, b: T) => boolean = (a, b) => a === b): T[] {
  return list.some((x) => eq(x, item)) ? list.filter((x) => !eq(x, item)) : [...list, item]
}

export function SlotGenerator({ admin, s }: P) {
  const [draft, setDraft] = useState<SlotDraft>({ dates: [], times: [PRESET_TIMES[0]], rooms: ['301', '302'] })
  const [dateInput, setDateInput] = useState('2026-12-17')
  const preview = makeSlots(draft)
  const have = new Set(s.slots.map((x) => x.slot_id))
  const fresh = preview.filter((x) => !have.has(x.slot_id)).length
  const sameTime = (a: [string, string], b: [string, string]) => a[0] === b[0] && a[1] === b[1]

  return (
    <div className="ad-gen">
      <div className="ad-field">
        <span className="ad-label">日期</span>
        <div className="ad-row">
          <input type="date" className="ad-input" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
          <button
            type="button"
            className="p-btn p-btn-outline"
            onClick={() => dateInput && !draft.dates.includes(dateInput) && setDraft({ ...draft, dates: [...draft.dates, dateInput].sort() })}
          >
            加入
          </button>
        </div>
        <div className="ad-pills">
          {draft.dates.length === 0 ? <span className="p-muted">尚未選日期</span> : null}
          {draft.dates.map((d) => (
            <button key={d} type="button" className="ad-pill ad-pill-on" onClick={() => setDraft({ ...draft, dates: draft.dates.filter((x) => x !== d) })}>
              {shortDate(d)} ×
            </button>
          ))}
        </div>
      </div>
      <div className="ad-field">
        <span className="ad-label">時段</span>
        <div className="ad-pills">
          {PRESET_TIMES.map((t) => {
            const on = draft.times.some((x) => sameTime(x, t))
            return (
              <button key={t.join()} type="button" aria-pressed={on} className={`ad-pill ${on ? 'ad-pill-on' : ''}`} onClick={() => setDraft({ ...draft, times: toggle(draft.times, t, sameTime) })}>
                {t[0]}–{t[1]}
              </button>
            )
          })}
        </div>
      </div>
      <div className="ad-field">
        <span className="ad-label">教室</span>
        <div className="ad-pills">
          {PRESET_ROOMS.map((r) => {
            const on = draft.rooms.includes(r)
            return (
              <button key={r} type="button" aria-pressed={on} className={`ad-pill ${on ? 'ad-pill-on' : ''}`} onClick={() => setDraft({ ...draft, rooms: toggle(draft.rooms, r) })}>
                {r}
              </button>
            )
          })}
        </div>
      </div>
      <div className="ad-gen-foot">
        <span className="p-muted">
          {draft.dates.length} 天 × {draft.times.length} 時段 × {draft.rooms.length} 間 = <strong className="ad-strong">{preview.length}</strong> 格
          {preview.length !== fresh ? `（其中 ${preview.length - fresh} 格已存在）` : ''}
        </span>
        <button type="button" className="p-btn ad-primary" disabled={fresh === 0} onClick={() => admin.addSlots(draft)}>
          新增 {fresh} 格
        </button>
      </div>
    </div>
  )
}

export function SlotList({ admin, s, compact = false }: P & { compact?: boolean }) {
  const rooms = roomsOnBoard(s.slots)
  const dates = [...new Set(s.slots.map((x) => x.date))]
  if (s.slots.length === 0) return <p className="p-muted ad-empty">這堂課還沒有可借格。</p>
  return (
    <div className={`ad-slotlist ${compact ? 'ad-slotlist-compact' : ''}`}>
      {dates.map((d) => (
        <div key={d} className="ad-slotday">
          <div className="ad-slotday-head">{shortDate(d)}</div>
          {s.slots
            .filter((x) => x.date === d)
            .map((x) => (
              <div key={x.slot_id} className="ad-slotrow">
                <span className="p-mono">
                  {x.start}–{x.end}
                </span>
                <RoomChip room={x.room} rooms={rooms} status={x.status} />
                <span className={x.status === 'booked' ? '' : 'p-text-open'}>{x.status === 'booked' ? x.booked_by : '可借'}</span>
                <span className="ad-slotrow-act">
                  {x.status === 'booked' ? (
                    <ConfirmButton label="強制取消" confirmLabel="確定取消？" className="p-btn p-btn-ghost ad-xs" onConfirm={() => admin.forceCancel(x.slot_id)} />
                  ) : (
                    <button type="button" className="p-btn p-btn-ghost ad-xs" onClick={() => admin.removeSlot(x.slot_id)}>
                      移除
                    </button>
                  )}
                </span>
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}

/** 名冊：不匯入，router Key Check 認得、呼叫過的學生才出現，依第一次呼叫排序。 */
export function SeenRoster({ s }: { s: AdminSession }) {
  if (s.students.length === 0) return <p className="p-muted ad-empty">還沒有學生呼叫過。學生的 Agent 第一次呼叫時，名字就會出現在這裡。</p>
  const count = (name: string) => s.slots.filter((x) => x.booked_by === name).length
  return (
    <ol className="ad-seen">
      {[...s.students]
        .sort((a, b) => a.firstSeen.getTime() - b.firstSeen.getTime())
        .map((st) => {
          const n = count(st.name)
          return (
            <li key={st.id}>
              <span>{st.name}</span>
              <span className={n ? 'ad-seen-ok' : 'p-muted'}>{n ? `已預約 ${n} 格` : '尚未預約'}</span>
            </li>
          )
        })}
    </ol>
  )
}

export function RulesForm({ admin, s }: P) {
  const r = s.rules
  const [max, setMax] = useState(r.maxPerStudent)
  const [start, setStart] = useState(r.windowStart)
  const [end, setEnd] = useState(r.windowEnd)
  return (
    <div className="ad-rules">
      <label className="ad-field">
        <span className="ad-label">每位學生最多預約</span>
        <span className="ad-row">
          <input type="number" min={1} max={5} className="ad-input ad-num" value={max} onChange={(e) => setMax(Number(e.target.value))} /> 格
        </span>
      </label>
      <label className="ad-field">
        <span className="ad-label">可預約時間（上課當天）</span>
        <span className="ad-row">
          <input type="time" className="ad-input" value={start} onChange={(e) => setStart(e.target.value)} />–
          <input type="time" className="ad-input" value={end} onChange={(e) => setEnd(e.target.value)} />
        </span>
      </label>
      <p className="p-muted ad-hint">⚠ 這些規則要跟 RAG 用的「預約規範」文件寫得一致，否則 agent 會講一套、系統做一套。</p>
      <button type="button" className="p-btn ad-primary" onClick={() => admin.setRules({ maxPerStudent: max, windowStart: start, windowEnd: end })}>
        儲存規則
      </button>
    </div>
  )
}

export function DisplayForm({ admin, s }: P) {
  const d = s.display
  return (
    <div className="ad-checks">
      <label className="ad-check">
        <input type="checkbox" checked={d.maskNames} onChange={(e) => admin.setDisplay({ ...d, maskNames: e.target.checked })} />
        <span>
          老師投影時遮蔽名稱<span className="p-muted">（王小明 → 王○明；分享連結一律顯示完整名稱）</span>
        </span>
      </label>
      <label className="ad-check">
        <input type="checkbox" checked={d.follow} onChange={(e) => admin.setDisplay({ ...d, follow: e.target.checked })} />
        <span>有人預約時監看頁自動跳到那一天</span>
      </label>
    </div>
  )
}

/** Agent Builder 共用空間的設定：API 工具與 MCP Server 都用 router OAuth（ADR 0003）。整個空間設一次，不是每堂課。 */
export function AgentBuilderCard() {
  const { copied, copy } = useCopy()
  const oauth: [string, string][] = [
    ['驗證方式', 'OAuth 2.0（使用者授權）'],
    ['Authorization URL', `${ROUTER_URL}/oauth/authorize`],
    ['Token URL', `${ROUTER_URL}/oauth/token`],
    ['Scopes', 'classroom'],
    ['Client ID', 'agent-builder'],
  ]
  const block = (title: string, first: [string, string]) => (
    <section className="ad-ab">
      <h3 className="ad-h3">{title}</h3>
      <dl className="ad-kv">
        {[first, ...oauth].map(([k, v]) => (
          <div key={k}>
            <dt className="p-muted">{k}</dt>
            <dd className="p-mono">{v}</dd>
            <button type="button" className="p-btn p-btn-ghost ad-xs" onClick={() => copy(`${title}-${k}`, v)}>
              {copied === `${title}-${k}` ? '已複製' : '複製'}
            </button>
          </div>
        ))}
        <div>
          <dt className="p-muted">Client Secret</dt>
          <dd className="p-muted">向 router 管理員索取，不顯示在這裡</dd>
          <span />
        </div>
      </dl>
    </section>
  )
  return (
    <div className="ad-keycard">
      <p className="p-muted ad-hint">整個 Agent Builder 空間只要設定一次。學生第一次用工具時，會被帶去 router 輸入邀請碼與暱稱（或 Google），不用發金鑰給學生。</p>
      {block('API 工具：預約系統', ['Base URL', API_BASE_URL])}
      {block('MCP Server：vans-mcp', ['URL', MCP_URL])}
      <div className="ad-row">
        <button type="button" className="p-btn p-btn-outline" onClick={() => copy('spec', '{ "openapi": "3.0.3", "...": "學生用 spec（原型示意）" }')}>
          {copied === 'spec' ? '已複製 spec' : '複製學生用 OpenAPI spec'}
        </button>
      </div>
      <p className="p-muted ad-hint">⚠ 平台的 OAuth Redirect URI 若顯示 localhost，學生授權後會導不回來，要請平台管理員改成實際網址。</p>
    </div>
  )
}

function remaining(until: Date): string {
  const ms = until.getTime() - Date.now()
  if (ms <= 0) return '已失效'
  const h = Math.floor(ms / 3600_000)
  const m = Math.floor((ms % 3600_000) / 60_000)
  return h ? `${h} 小時 ${m} 分後失效` : `${m} 分後失效`
}

/** 分享連結：學生免登入看唯讀看板、顯示完整名稱（ADR 0005）。 */
export function ShareLinkCard({ admin, s }: P) {
  const { copied, copy } = useCopy()
  if (!s.share)
    return (
      <div className="ad-share">
        <p className="p-muted ad-hint">產生後把連結給學生，學生不用登入就能看到這堂課的看板（唯讀、顯示完整名稱），確認自己的 Agent 有沒有預約成功。{SHARE_HOURS} 小時後自動失效。</p>
        <button type="button" className="p-btn ad-primary" onClick={admin.makeShare}>
          產生學生分享連結
        </button>
      </div>
    )
  const url = `${SHARE_BASE_URL}/${s.share.token}`
  return (
    <div className="ad-share">
      <dl className="ad-kv">
        <div>
          <dt className="p-muted">分享連結</dt>
          <dd className="p-mono">{url}</dd>
          <button type="button" className="p-btn p-btn-ghost ad-xs" onClick={() => copy('share', url)}>
            {copied === 'share' ? '已複製' : '複製'}
          </button>
        </div>
        <div>
          <dt className="p-muted">有效期限</dt>
          <dd>{remaining(s.share.expiresAt)}</dd>
          <span />
        </div>
      </dl>
      <div className="ad-row">
        <a className="p-btn p-btn-outline" href={`/prototype-board.html?variant=C2&session=${s.id}&view=student`} target="_blank" rel="noreferrer">
          預覽學生看到的畫面 ↗
        </a>
        <ConfirmButton label="重新產生" confirmLabel="確定？舊連結立即失效" onConfirm={admin.makeShare} />
        <ConfirmButton label="關閉分享" confirmLabel="確定關閉？" onConfirm={admin.closeShare} />
      </div>
    </div>
  )
}

export function AdminLogList({ admin }: { admin: DemoAdmin }) {
  if (admin.logs.length === 0) return <p className="p-muted">還沒有操作。</p>
  return (
    <ol className="ad-log">
      {admin.logs.map((l) => (
        <li key={l.id} className={`ad-log-${l.tone}`}>
          <span className="p-muted p-mono">{l.at.toLocaleTimeString('zh-Hant', { hour12: false })}</span> {l.text}
        </li>
      ))}
    </ol>
  )
}

/** 老師由 router Google 登入；班級清單是 router 告訴後台的。 */
export function TeacherBar({ admin }: { admin: DemoAdmin }) {
  return (
    <div className="ad-row ad-teacher">
      <span className="p-muted">以 Google 經 router 登入</span>
      <strong>{admin.teacher.name}</strong>
      <button type="button" className="p-btn p-btn-ghost ad-xs">
        登出
      </button>
    </div>
  )
}

export function ClassPicker({ admin }: { admin: DemoAdmin }) {
  return (
    <select className="ad-input" value={admin.classId} onChange={(e) => admin.selectClass(Number(e.target.value))} aria-label="選擇班級">
      {admin.classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}

export function SessionPicker({ admin, s }: P) {
  const isCurrent = s.id === admin.currentId
  return (
    <div className="ad-row">
      <select className="ad-input" value={s.id} onChange={(e) => admin.view(e.target.value)} aria-label="選擇堂課">
        {admin.classSessions.map((x) => (
          <option key={x.id} value={x.id}>
            {x.id === admin.currentId ? '● ' : ''}
            {x.title}
          </option>
        ))}
      </select>
      {isCurrent ? (
        <span className="ad-current">目前堂課</span>
      ) : (
        <ConfirmButton label="設為目前堂課" confirmLabel="確定？學生之後都進這堂" onConfirm={() => admin.makeCurrent(s.id)} />
      )}
    </div>
  )
}

export function NewSessionForm({ admin, onDone }: { admin: DemoAdmin; onDone?: () => void }) {
  const [id, setId] = useState('ai-1223')
  const [title, setTitle] = useState('')
  const [copyFrom, setCopyFrom] = useState(admin.current?.id ?? '')
  return (
    <div className="ad-newsession">
      <p className="p-muted ad-hint">建立後自動成為這個班級的目前堂課；學生不用知道堂課代號。</p>
      <label className="ad-field">
        <span className="ad-label">堂課代號（只給老師辨識）</span>
        <input className="ad-input p-mono" value={id} onChange={(e) => setId(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())} />
      </label>
      <label className="ad-field">
        <span className="ad-label">名稱</span>
        <input className="ad-input" value={title} placeholder="例如：12/23 Agent Builder（三）" onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="ad-field">
        <span className="ad-label">複製設定自</span>
        <select className="ad-input" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
          <option value="">（不複製，從空白開始）</option>
          {admin.classSessions.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}（可借清單、規則；不含預約）
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="p-btn ad-primary" onClick={() => admin.createSession(id, title, copyFrom || undefined) && onDone?.()}>
        建立堂課
      </button>
    </div>
  )
}
