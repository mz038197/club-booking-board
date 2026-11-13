// PROTOTYPE — throwaway.
// 問題：教師月曆監看用 shadcn 風格（.claude/skills/design-system/SKILL.md）該長什麼樣？
// 結論：C2 勝出（見 commit 7ea8918 訊息）。
// 版本用 ?variant=A|B|C|C2 切換；底部浮動列可切換、控制模擬。
// 資料全在記憶體（demoBoard.ts），不接後端。正式版會以 Next.js 重寫，這裡只決定版面。
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useDemoBoard, type DemoBoard } from './demoBoard.ts'
import { PrototypeSwitcher, useVariantParam } from './switcher.tsx'
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

function Root() {
  const [variant, setVariant] = useVariantParam(VARIANTS)
  const board = useDemoBoard()
  const V = VARIANTS.find((v) => v.key === variant) ?? VARIANTS[0]
  const booked = board.slots.filter((s) => s.status === 'booked').length
  return (
    <>
      <V.C key={V.key} board={board} />
      <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={setVariant}>
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
      </PrototypeSwitcher>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
