import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createHttpBoardApi, defaultApiBaseUrl, type BoardApi, type MockBoardApi } from './api/client.ts'
import { formatApiError } from './api/errors.ts'
import { createDemoMockApi, DEMO_SESSION_ID } from './api/mockApi.ts'
import type { BoardSlot, SlotSpec } from './api/types.ts'
import { BoardGrid } from './board/BoardGrid.tsx'
import { formatSlotId } from './board/slotId.ts'
import { SlotEditor } from './teacher/SlotEditor.tsx'
import './App.css'

const POLL_MS = 4000
const USE_MOCK_KEY = 'club-booking-use-mock'
const SESSION_KEY = 'club-booking-session-id'

function readSessionParam(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('session')
  if (fromQuery?.trim()) return fromQuery.trim()
  const stored = localStorage.getItem(SESSION_KEY)
  if (stored?.trim()) return stored.trim()
  return DEMO_SESSION_ID
}

function asSlotSpecs(slots: BoardSlot[]): SlotSpec[] {
  return slots.map(({ date, start, end, room }) => ({ date, start, end, room }))
}

function specsEqual(a: SlotSpec[], b: SlotSpec[]): boolean {
  if (a.length !== b.length) return false
  const keys = (slots: SlotSpec[]) =>
    slots
      .map(formatSlotId)
      .sort()
      .join('|')
  return keys(a) === keys(b)
}

export default function App() {
  const apiBaseUrl = defaultApiBaseUrl()
  const [useMock, setUseMock] = useState(() => {
    const stored = localStorage.getItem(USE_MOCK_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
    return !import.meta.env.VITE_API_BASE_URL
  })
  const [sessionDraft, setSessionDraft] = useState(readSessionParam)
  const [sessionId, setSessionId] = useState(readSessionParam)
  const [slots, setSlots] = useState<BoardSlot[]>([])
  const [editorSlots, setEditorSlots] = useState<SlotSpec[]>([])
  const [dirty, setDirty] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [debugWho, setDebugWho] = useState('第三組')
  const [debugSlotId, setDebugSlotId] = useState('')
  const [debugError, setDebugError] = useState<string | null>(null)

  const mockApi = useMemo(() => createDemoMockApi(), [])
  const httpApi = useMemo(() => createHttpBoardApi(apiBaseUrl), [apiBaseUrl])
  const api: BoardApi = useMock ? mockApi : httpApi
  const mock: MockBoardApi | null = useMock ? mockApi : null

  useEffect(() => {
    localStorage.setItem(USE_MOCK_KEY, String(useMock))
  }, [useMock])

  useEffect(() => {
    localStorage.setItem(SESSION_KEY, sessionId)
    const url = new URL(window.location.href)
    url.searchParams.set('session', sessionId)
    window.history.replaceState(null, '', url)
  }, [sessionId])

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      try {
        const board = await api.getBoard(sessionId)
        if (cancelled) return
        setSlots(board.slots)
        setUpdatedAt(new Date())
        setLoadError(null)
        setEditorSlots((current) => {
          if (dirty) return current
          return asSlotSpecs(board.slots)
        })
      } catch (error) {
        if (cancelled) return
        setLoadError(formatApiError(error))
      }
    }

    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [api, sessionId, dirty])

  function applySession(event: FormEvent) {
    event.preventDefault()
    const next = sessionDraft.trim()
    if (!next) return
    setDirty(false)
    setSaveError(null)
    setSessionId(next)
  }

  function onEditorChange(next: SlotSpec[]) {
    setEditorSlots(next)
    setDirty(!specsEqual(next, slots))
  }

  function reloadEditorFromBoard() {
    setEditorSlots(asSlotSpecs(slots))
    setDirty(false)
    setSaveError(null)
  }

  async function saveSlots() {
    setSaving(true)
    setSaveError(null)
    try {
      await api.replaceAvailableSlots(sessionId, editorSlots)
      const board = await api.getBoard(sessionId)
      setSlots(board.slots)
      setEditorSlots(asSlotSpecs(board.slots))
      setDirty(false)
      setUpdatedAt(new Date())
    } catch (error) {
      setSaveError(formatApiError(error))
    } finally {
      setSaving(false)
    }
  }

  async function debugBook() {
    if (!mock || !debugSlotId) return
    setDebugError(null)
    try {
      await mock.book(sessionId, debugSlotId, debugWho.trim() || '未命名')
      const board = await mock.getBoard(sessionId)
      setSlots(board.slots)
    } catch (error) {
      setDebugError(formatApiError(error))
    }
  }

  async function debugCancel() {
    if (!mock || !debugSlotId) return
    setDebugError(null)
    try {
      await mock.cancel(sessionId, debugSlotId, debugWho.trim() || '未命名')
      const board = await mock.getBoard(sessionId)
      setSlots(board.slots)
    } catch (error) {
      setDebugError(formatApiError(error))
    }
  }

  return (
    <div className="page">
      <header className="top-bar">
        <div>
          <p className="eyebrow">課堂投影看板</p>
          <h1>社團教室出借看板</h1>
        </div>
        <form className="session-form" onSubmit={applySession}>
          <label>
            堂課 session_id
            <input
              value={sessionDraft}
              onChange={(event) => setSessionDraft(event.target.value)}
              placeholder="demo"
              autoComplete="off"
            />
          </label>
          <button type="submit" className="btn primary">
            載入
          </button>
        </form>
      </header>

      <div className="meta-row">
        <label className="toggle">
          <input
            type="checkbox"
            checked={useMock}
            onChange={(event) => {
              setDirty(false)
              setUseMock(event.target.checked)
            }}
          />
          本機模擬（無後端）
        </label>
        <p className="meta">
          API：{useMock ? '記憶體模擬' : apiBaseUrl}　輪詢 {POLL_MS / 1000} 秒
          {updatedAt ? `　最後更新 ${updatedAt.toLocaleTimeString('zh-Hant')}` : ''}
        </p>
      </div>

      {loadError ? <p className="banner error">看板載入失敗：{loadError}</p> : null}

      <BoardGrid slots={slots} />

      <SlotEditor
        slots={editorSlots}
        onChange={onEditorChange}
        onSave={() => void saveSlots()}
        onReload={reloadEditorFromBoard}
        saving={saving}
        dirty={dirty}
      />
      {saveError ? <p className="banner error">{saveError}</p> : null}

      {mock ? (
        <section className="debug-panel">
          <h2>本機除錯：模擬學生預約</h2>
          <p className="hint">真實預約／取消是 agent API，這裡只方便沒有後端時看看板變化。</p>
          <div className="debug-form">
            <label>
              slot_id
              <select value={debugSlotId} onChange={(event) => setDebugSlotId(event.target.value)}>
                <option value="">選擇格子</option>
                {slots.map((slot) => (
                  <option key={slot.slot_id} value={slot.slot_id}>
                    {slot.slot_id}（{slot.status === 'booked' ? `已預約 ${slot.booked_by ?? ''}` : '可借'}）
                  </option>
                ))}
              </select>
            </label>
            <label>
              booked_by
              <input value={debugWho} onChange={(event) => setDebugWho(event.target.value)} />
            </label>
            <button type="button" className="btn" onClick={() => void debugBook()}>
              模擬預約
            </button>
            <button type="button" className="btn" onClick={() => void debugCancel()}>
              模擬取消
            </button>
          </div>
          {debugError ? <p className="error">{debugError}</p> : null}
        </section>
      ) : null}
    </div>
  )
}
