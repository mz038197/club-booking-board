import { useState, type FormEvent } from 'react'
import type { SlotSpec } from '../api/types.ts'
import { formatSlotId } from '../board/slotId.ts'

type SlotEditorProps = {
  slots: SlotSpec[]
  onChange: (slots: SlotSpec[]) => void
  onSave: () => void
  onReload: () => void
  saving: boolean
  dirty: boolean
}

const emptyDraft: SlotSpec = {
  date: '',
  start: '',
  end: '',
  room: '',
}

export function SlotEditor({ slots, onChange, onSave, onReload, saving, dirty }: SlotEditorProps) {
  const [draft, setDraft] = useState<SlotSpec>(emptyDraft)
  const [formError, setFormError] = useState<string | null>(null)

  function addSlot(event: FormEvent) {
    event.preventDefault()
    if (!draft.date || !draft.start || !draft.end || !draft.room.trim()) {
      setFormError('請填齊日期、開始、結束、教室編號。')
      return
    }
    if (draft.end <= draft.start) {
      setFormError('結束時間須晚於開始時間。')
      return
    }
    const next = {
      date: draft.date,
      start: draft.start,
      end: draft.end,
      room: draft.room.trim(),
    }
    const id = formatSlotId(next)
    if (slots.some((slot) => formatSlotId(slot) === id)) {
      setFormError('清單裡已有同一格。')
      return
    }
    setFormError(null)
    onChange([...slots, next])
    setDraft({ ...draft, room: '' })
  }

  function removeAt(index: number) {
    onChange(slots.filter((_, i) => i !== index))
  }

  return (
    <section className="teacher-panel">
      <h2>教師：設定本堂可借清單</h2>
      <p className="hint">
        儲存會以 PUT 完整取代可借格子。若清單拿掉已有預約的格子，後端會回 CONFLICT。
      </p>

      <ul className="slot-list">
        {slots.length === 0 ? <li className="muted">（空清單）</li> : null}
        {slots.map((slot, index) => (
          <li key={formatSlotId(slot)}>
            <span className="slot-label">
              {slot.date}　{slot.start}–{slot.end}　教室 {slot.room}
            </span>
            <button type="button" className="btn-ghost" onClick={() => removeAt(index)}>
              移除
            </button>
          </li>
        ))}
      </ul>

      <form className="add-form" onSubmit={addSlot}>
        <label>
          日期
          <input
            type="date"
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
          />
        </label>
        <label>
          開始
          <input
            type="time"
            value={draft.start}
            onChange={(event) => setDraft({ ...draft, start: event.target.value.slice(0, 5) })}
          />
        </label>
        <label>
          結束
          <input
            type="time"
            value={draft.end}
            onChange={(event) => setDraft({ ...draft, end: event.target.value.slice(0, 5) })}
          />
        </label>
        <label>
          教室
          <input
            type="text"
            placeholder="301"
            value={draft.room}
            onChange={(event) => setDraft({ ...draft, room: event.target.value })}
          />
        </label>
        <button type="submit" className="btn">
          加入清單
        </button>
      </form>
      {formError ? <p className="error">{formError}</p> : null}

      <div className="editor-actions">
        <button type="button" className="btn primary" onClick={onSave} disabled={saving}>
          {saving ? '儲存中…' : '儲存（完整覆蓋）'}
        </button>
        <button type="button" className="btn" onClick={onReload} disabled={saving}>
          從看板重新載入
        </button>
        {dirty ? <span className="dirty">有未儲存變更</span> : null}
      </div>
    </section>
  )
}
