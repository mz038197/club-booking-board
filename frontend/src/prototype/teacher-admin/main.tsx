// PROTOTYPE — throwaway.
// 老師管理後台：已選定版本 C「課前精靈＋上課模式」（A 設定分頁、B 上課控制台已淘汰），
// 並照 ADR 0003–0005 改寫。資料全在記憶體（demoAdmin.ts），不接後端。
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useDemoAdmin } from './demoAdmin.ts'
import { VariantC } from './VariantC.tsx'
import '../teacher-board/styles.css'
import './admin.css'

function Root() {
  const admin = useDemoAdmin()
  return <VariantC key={admin.classId} admin={admin} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
