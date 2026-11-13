// PROTOTYPE — 選定版本 C「課前精靈＋上課模式」，已照 ADR 0003–0005 改寫：
//   課前準備：可借清單 → 預約規則 → Agent Builder 設定 → 學生分享連結 → 投影顯示
//   上課中：緊急暫停、統計、預約（可強制取消）、名冊（呼叫過才出現）、操作紀錄
// 沒有「開放預約」：學生能不能預約跟著他課堂金鑰的時效。
import { useState } from 'react'
import type { DemoAdmin } from './demoAdmin.ts'
import {
  AdminLogList,
  AgentBuilderCard,
  ClassPicker,
  ConfirmButton,
  DisplayForm,
  NewSessionForm,
  PauseSwitch,
  RulesForm,
  SeenRoster,
  SessionPicker,
  ShareLinkCard,
  SlotGenerator,
  SlotList,
  Stats,
  TeacherBar,
} from './parts.tsx'

export function VariantC({ admin }: { admin: DemoAdmin }) {
  const s = admin.current
  const [mode, setMode] = useState<'prep' | 'live'>(s && s.slots.length > 0 ? 'live' : 'prep')
  const [step, setStep] = useState(0)
  const [abDone, setAbDone] = useState(false)
  const [rulesDone, setRulesDone] = useState(false)

  const head = (
    <header className="adc-head">
      <div className="ad-row">
        <ClassPicker admin={admin} />
        {s ? <SessionPicker admin={admin} s={s} /> : null}
        <details className="adc-new">
          <summary className="p-btn p-btn-outline">＋ 新堂課</summary>
          <div className="p-card ad-pad adc-pop">
            <NewSessionForm key={admin.classId} admin={admin} onDone={() => setMode('prep')} />
          </div>
        </details>
      </div>
      <div className="ad-row">
        {s ? (
          <div className="adc-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'prep'} className={mode === 'prep' ? 'adc-tab-on' : ''} onClick={() => setMode('prep')}>
              ① 課前準備
            </button>
            <button type="button" role="tab" aria-selected={mode === 'live'} className={mode === 'live' ? 'adc-tab-on' : ''} onClick={() => setMode('live')}>
              ② 上課中
            </button>
          </div>
        ) : null}
        <TeacherBar admin={admin} />
      </div>
    </header>
  )

  if (!s)
    return (
      <div className="adc">
        {head}
        <section className="p-card ad-pad adc-empty">
          <h2 className="ad-h2">這個班級還沒有堂課</h2>
          <NewSessionForm key={admin.classId} admin={admin} />
        </section>
      </div>
    )

  const steps = [
    { title: '可借清單', done: s.slots.length > 0, hint: `${s.slots.length} 格`, body: <><SlotGenerator admin={admin} s={s} /><div className="ad-gap" /><SlotList admin={admin} s={s} compact /></> },
    { title: '預約規則', done: rulesDone, hint: `每人 ${s.rules.maxPerStudent} 格`, body: <div onClickCapture={() => setRulesDone(true)}><RulesForm key={s.id} admin={admin} s={s} /></div> },
    { title: 'Agent Builder 設定', done: abDone, hint: '整個空間設一次', body: <div onClickCapture={() => setAbDone(true)}><AgentBuilderCard /></div> },
    { title: '學生分享連結', done: Boolean(s.share), hint: s.share ? '已產生' : '未產生', body: <ShareLinkCard admin={admin} s={s} /> },
    { title: '投影顯示', done: true, hint: s.display.maskNames ? '遮蔽名稱' : '顯示名稱', body: <DisplayForm admin={admin} s={s} /> },
  ]
  const ready = steps.every((x) => x.done)

  return (
    <div className="adc">
      {head}
      {mode === 'prep' ? (
        <div className="adc-prep">
          <ol className="adc-steps">
            {steps.map((x, i) => (
              <li key={x.title} className={`adc-step ${i === step ? 'adc-step-on' : ''} ${x.done ? 'adc-step-done' : ''}`}>
                <button type="button" className="adc-step-head" onClick={() => setStep(i)} aria-expanded={i === step}>
                  <span className="adc-step-num">{x.done ? '✓' : i + 1}</span>
                  <span className="adc-step-title">{x.title}</span>
                  <span className="p-muted">{x.hint}</span>
                </button>
                {i === step ? (
                  <div className="adc-step-body">
                    {x.body}
                    <div className="ad-row adc-step-nav">
                      {i > 0 ? (
                        <button type="button" className="p-btn p-btn-outline" onClick={() => setStep(i - 1)}>
                          上一步
                        </button>
                      ) : null}
                      {i < steps.length - 1 ? (
                        <button type="button" className="p-btn ad-primary" onClick={() => setStep(i + 1)}>
                          下一步
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <aside className="p-card ad-pad adc-ready">
            <h2 className="ad-h2">準備狀態</h2>
            <ul className="adc-checklist">
              {steps.map((x) => (
                <li key={x.title} className={x.done ? 'adc-ok' : ''}>
                  {x.done ? '✓' : '○'} {x.title}
                </li>
              ))}
            </ul>
            <p className="p-muted ad-hint">不必按「開放」：課堂開始時間一到，學生用邀請碼換到的金鑰就能預約；下課自動失效。</p>
            <button type="button" className="p-btn ad-primary adc-go" disabled={!ready} onClick={() => setMode('live')}>
              {ready ? '進入上課模式 →' : '完成上面步驟後再進入'}
            </button>
          </aside>
        </div>
      ) : (
        <div className="adc-live">
          <section className="adc-live-top">
            <PauseSwitch admin={admin} s={s} size="xl" />
            <div className="ad-row">
              <a className="p-btn p-btn-outline" href={`/prototype-board.html?variant=C2&session=${s.id}`} target="_blank" rel="noreferrer">
                投影監看頁 ↗
              </a>
              <ConfirmButton label="重置堂課" confirmLabel="確定重置？" onConfirm={admin.resetSession} />
            </div>
          </section>
          <Stats s={s} />
          <div className="adc-live-cols">
            <section className="p-card ad-pad">
              <h2 className="ad-h2">預約（可強制取消）</h2>
              <SlotList admin={admin} s={s} compact />
            </section>
            <div className="ad-stack">
              <section className="p-card ad-pad">
                <h2 className="ad-h2">名冊（{s.students.length} 人呼叫過）</h2>
                <SeenRoster s={s} />
              </section>
              <section className="p-card ad-pad">
                <h2 className="ad-h2">學生分享連結</h2>
                <ShareLinkCard admin={admin} s={s} />
              </section>
              <section className="p-card ad-pad">
                <h2 className="ad-h2">操作紀錄</h2>
                <AdminLogList admin={admin} />
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
