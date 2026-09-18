# 教師看板（frontend）

課堂投影用的社團教室出借看板。獨立 Vite + React + TypeScript 頁面，以短輪詢讀取堂課格子。

## 啟動

```bash
cd frontend
npm install
npm run dev
```

瀏覽器開啟終端機顯示的本機網址（預設 `http://localhost:5173`）。

- 預設 `session_id` 為 `demo`，也可在頂部輸入或用 `?session=`。
- 沒設 `VITE_API_BASE_URL` 時，頁面預設走「本機模擬」，可直接看可借／已預約格子。
- 接真實後端：複製 `.env.example` 為 `.env`，設定 `VITE_API_BASE_URL`，並取消勾選「本機模擬」。

```bash
npm test    # 契約與看板分組測試
npm run build
```

## 接上的 API

Base URL：`VITE_API_BASE_URL`（例：`http://localhost:3000`）

| 方法 | 路徑 | 用途 |
|------|------|------|
| `GET` | `/sessions/{session_id}/board` | 輪詢看板 `{ slots: [{ slot_id, date, start, end, room, status, booked_by? }] }` |
| `PUT` | `/sessions/{session_id}/slots` | 教師完整覆蓋可借清單 `{ slots: [{ date, start, end, room }] }` |

`slot_id`：`{date}_{start}-{end}_{room}`，例 `2026-09-25_13:00-15:00_301`。

4xx 若帶 `code`（`SLOT_TAKEN` / `NOT_OWNER` / `NOT_FOUND` / `INVALID_SLOT` / `CONFLICT`）會顯示在畫面上。教師儲存若因移除已預約格而 `CONFLICT`，會有明確提示。

學生預約／取消／海報是 agent API，此頁不實作；本機模擬模式有小型除錯面板方便看格子變化。
