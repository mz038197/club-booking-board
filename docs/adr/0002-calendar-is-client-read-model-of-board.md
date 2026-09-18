# 月曆監看由前端聚合既有看板快照，不新增月曆 API

月曆需要的是把**看板**上的可借格依日期歸到日格與日展開，資料已在 `GET /sessions/{session_id}/board`。我們決定本版由教師前端做讀模型聚合，不新增後端月曆端點、不改看板 payload、不改輪詢方式。學生與 agent 契約維持不變。若之後堂課可借格跨很多個月、payload 太大，再加專用月曆 API 仍可逆；現在加端點會讓兩份讀模型並行、卻還沒有規模問題。

**Considered Options**: 新的 `GET .../calendar`（按月篩選）；SSE／WebSocket 推播；從月曆畫面寫入可借格。
