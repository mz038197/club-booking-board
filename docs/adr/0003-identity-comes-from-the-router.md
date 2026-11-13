# 學生與教師的身分都來自 router，本系統不自建登入

狀態：proposed。

課堂上全班共用一個 MiTAC Agent Builder 空間；API 工具與 MCP Server 只能各設一次，靠單一金鑰分不出學生。router 成為 OAuth 授權伺服器（router ADR 0094），學生在 Agent Builder 第一次用工具時輸入邀請碼與暱稱（或 Google），平台替每位學生保存他這堂課的課堂金鑰。

- **學生**：學生介面一律從 `Authorization: Bearer` 取得課堂金鑰，向 router 的 Key Check 確認（快取 60 秒，同 vans-mcp-server），得到學生、班級與顯示名稱。介面不再收 `student_id`，也不收堂課 id。教師的個人金鑰在學生介面一律 403，教師示範學生流程時改用課堂金鑰。金鑰過期或課堂未開始回 401，轉述 router 的說明。
- **教師**：後台以 router 的 `openid teacher` 登入（Google，限教師與管理員），只取得身分，不取得任何金鑰。登入狀態放在簽章 cookie（12 小時），不建登入資料表。每次請求用本系統的服務憑證向 router 查這位教師可管理的班級（快取 60 秒）；教師被拿走班級，一分鐘內就管不到。
- 本系統只存學生 id 與顯示名稱（每次 Key Check 更新），不存任何 router 金鑰。

## Considered Options

- **每位學生一個 Agent Builder 空間、各貼自己的金鑰**：放棄，神通未必能開，且全班共用空間時無效。
- **預約碼（學生到本系統換短碼，Agent 當參數帶入）**：放棄，碼會出現在對話與提示詞裡，且只解決預約，不解決 MCP。
- **教師貼個人金鑰登入，或 router 把個人金鑰交給後台**：放棄，長期金鑰會離開 router、存進本系統。
- **後台自建 Google 登入，再用 email 向 router 查班級**：放棄，router 刻意不對外給 email。
- **登入狀態存資料表以便強制登出**：暫不做，權限每分鐘由 router 重新確認；需要「登出所有裝置」或登入稽核時再加。
