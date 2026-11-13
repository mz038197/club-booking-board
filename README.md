# club-booking-board

社團教室出借看板：學生打造會借教室的 Agent，以課堂金鑰呼叫 API 或 MCP 預約可借格；教師在後台開堂課、監看投影看板。用語見 [`CONTEXT.md`](CONTEXT.md)，決策見 [`docs/adr/`](docs/adr/)，v2 規格見 issue #14（原始產品規格：[`docs/specs/club-classroom-booking-v1.md`](docs/specs/club-classroom-booking-v1.md)）。

正式站：https://club-booking-board.vercel.app

## 版面

| 路徑 | 內容 |
|------|------|
| `web/` | Next.js App Router：首頁、教師後台、投影看板、分享連結、學生 API `/api/v1` |
| `web/db/migrations/` | Postgres schema（正式站在 Supabase） |
| `docs/` | 規格、ADR 與 agent 文件 |
| `.agents/skills/` | Cursor 工程 skills |

身分一律來自 router（ai.vanscoding.com）：教師以 Google 經 router 登入，學生用自己的課堂金鑰（ADR 0003）。

## Run locally

```bash
cd web
npm install
cp .env.example .env.local   # 本機設 ROUTER_GATEWAY=fake，用假的 router 登入
npm run db:seed              # PGlite：建表並放一堂示範堂課
npm run dev
```

說明都在 `web/.env.example`。PGlite 一次只允許一個程序，seed 前先停掉 dev server。

## Tests

```bash
cd web
npm test            # vitest，PGlite
npm run typecheck
npm run lint
```

真正的 Postgres 並發測試是選用的：設 `TEST_DATABASE_URL` 指向一台可以建資料庫的 Postgres 再跑 `npm test`。

## 學生 API

Agent 呼叫 `/api/v1`（`Authorization: Bearer <課堂金鑰>`）：

| Method | Path | 用途 |
|--------|------|------|
| GET | `/api/v1/slots` | 查目前堂課的可借格 |
| POST | `/api/v1/bookings` | 預約一格 |
| GET | `/api/v1/bookings` | 查自己的預約 |
| DELETE | `/api/v1/bookings/{id}` | 取消自己的預約 |
| POST | `/api/v1/poster/copy` | 海報文案 |

完整規格（給 Agent Builder 匯入）：`/api/v1/openapi.json`。

## Deploy

The Vercel project `club-booking-board` (team vans-coding) is connected to this repo with Root Directory `web`:

- Push or merge to `main` → production, https://club-booking-board.vercel.app (real router).
- Any other branch or PR → a preview URL behind Vercel Authentication, using the fake router (`ROUTER_GATEWAY=fake`). Preview currently shares production's database, so anything you do there as a fake teacher writes real data.

Run migrations against the database yourself before merging a change that adds one (`cd web && npm run db:migrate` with `DATABASE_URL` set). Environment variables live in Vercel; see `web/.env.example`.

## Agent skills

This repo installs [Matt Pocock's engineering skills](https://github.com/mattpocock/skills) for Cursor under `.agents/skills`, locked in `skills-lock.json`.
