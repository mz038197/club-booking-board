# club-booking-board

課堂社團預約板（學生專案）。v1 後端：FastAPI + SQLite，教師開格、學生預約／取消、看板查詢、海報文案（不出圖）。

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export DATABASE_PATH=booking.db
uvicorn app.main:create_default_app --factory --app-dir backend --host 0.0.0.0 --port 8000
```

OpenAPI: http://127.0.0.1:8000/docs

## Tests

Install runtime deps plus test-only packages (`pytest`, `httpx`) via `backend/requirements-dev.txt` (includes `-r requirements.txt`). Production `requirements.txt` does not include pytest.

```bash
pip install -r backend/requirements-dev.txt
python3 -m pytest
```

## API (v1)

Owner identity for cancel is query param `student_id`.

| Method | Path | Notes |
|--------|------|--------|
| PUT | `/sessions/{session_id}/slots` | Full replace of **open** slots. Body `{ "slots": [{ date, start, end, room }] }`. Removing a booked slot → 409 `CONFLICT`. |
| GET | `/sessions/{session_id}/board` | `{ "slots": [{ slot_id, date, start, end, room, status, booked_by? }] }` `status` is `open` or `booked`. |
| POST | `/sessions/{session_id}/bookings` | `{ slot_id, student_id }` → 201 `{ booking_id, slot_id, student_id }`. Taken → 409 `SLOT_TAKEN`. |
| DELETE | `/sessions/{session_id}/bookings/{booking_id}?student_id=` | Owner only. Wrong owner → 403 `NOT_OWNER`. Missing → 404 `NOT_FOUND`. |
| POST | `/poster/copy` | `{ title, time, place, notes? }` → `{ title, time_place, slogan, body }` (no images). |

`slot_id` format: `{date}_{start}-{end}_{room}` e.g. `2026-09-25_13:00-15:00_301`.

4xx envelope: `{ "code": "SLOT_TAKEN" \| "NOT_OWNER" \| "NOT_FOUND" \| "INVALID_SLOT" \| "INVALID_POSTER" \| "INVALID_REQUEST" \| "CONFLICT", "message"? }`.

Validation: unknown / malformed slot → `INVALID_SLOT`; poster body → `INVALID_POSTER`; other request shape → `INVALID_REQUEST`. Race / booking codes (`SLOT_TAKEN`, `CONFLICT`, `NOT_OWNER`, `NOT_FOUND`) are unchanged.
