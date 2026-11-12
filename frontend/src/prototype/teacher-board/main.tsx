// PROTOTYPE — throwaway.
// 問題：教師月曆監看用 shadcn 風格（.claude/skills/design-system/SKILL.md）該長什麼樣？
// 三個結構不同的版本，同一頁用 ?variant=A|B|C 切換；底部浮動列可切換、控制模擬。
// 資料全在記憶體（demoBoard.ts），不接後端。正式版會以 Next.js 重寫，這裡只決定版面。
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useDemoBoard, type DemoBoard } from './demoBoard.ts'
import { VariantA, name as nameA } from './VariantA.tsx'
import { VariantB, name as nameB } from './VariantB.tsx'
import { VariantC, name as nameC } from './VariantC.tsx'
import { VariantC2, name as nameC2 } from './VariantC2.tsx'
import './styles.css'

const VARIANTS: { key: string; name: string; C: (p: { board: DemoBoard }) => React.JSX.Element }[] = [
  { key: 'A', name: nameA, C: VariantA },
  { key: 'B', name: nameB, C: VariantB },
  { key: 'C', name: nameC, C: VariantC },
  { key: 'C2', name: nameC2, C: VariantC2 },
]

function readVariant(): string {
  const v = new URLSearchParams(window.location.search).get('variant')?.toUpperCase()
  return VARIANTS.some((x) => x.key === v) ? (v as string) : 'A'
}

function PrototypeSwitcher({
  current,
  onChange,
  board,
}: {
  current: string
  onChange: (key: string) => void
  board: DemoBoard
}) {
  const i = VARIANTS.findIndex((v) => v.key === current)
  const go = (d: number) => onChange(VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length].key)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement | null)?.isContentEditable) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!import.meta.env.DEV) return null
  const booked = board.slots.filter((s) => s.status === 'booked').length
  return (
    <div className="proto-bar" role="toolbar" aria-label="原型切換列">
      <button type="button" onClick={() => go(-1)} aria-label="上一個版本">
        ←
      </button>
      <span className="proto-label">
        {current}（{VARIANTS[i].name}）
      </span>
      <button type="button" onClick={() => go(1)} aria-label="下一個版本">
        →
      </button>
      <span className="proto-sep" />
      <button type="button" onClick={() => board.setAuto(!board.auto)}>
        {board.auto ? '⏸ 暫停模擬' : '▶ 自動模擬'}
      </button>
      <button type="button" onClick={board.step}>
        +1 筆
      </button>
      <button type="button" onClick={board.reset}>
        重置
      </button>
      <span className="proto-state">
        {board.slots.length} 格 · 已借 {booked} · 事件 {board.events.length}
      </span>
    </div>
  )
}

function Root() {
  const [variant, setVariant] = useState(readVariant)
  const board = useDemoBoard()

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('variant', variant)
    window.history.replaceState(null, '', url)
  }, [variant])

  const V = VARIANTS.find((v) => v.key === variant) ?? VARIANTS[0]
  return (
    <>
      <V.C key={V.key} board={board} />
      <PrototypeSwitcher current={variant} onChange={setVariant} board={board} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
