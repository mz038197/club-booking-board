Copied from the router repo `docs/contracts/teacher-classes/` (vans_coding_router, ADR 0094 class lookup).

Request: `POST {ROUTER_URL}/internal/teacher-classes`
  headers `Authorization: Bearer <Service Credential>`, `Content-Type: application/json`
  body `{"user_id": 42}`

200 answers: `accepted.json` (the user may manage these Classes; `is_admin: true` = every Class) and
`refused.json` (unknown user or not a teacher/admin: treated as no Classes).
Anything else (`unauthorized.json` 401, `bad-request.json` 400, other non-200, unreadable body,
timeout over 3 s) → unavailable. When the router contract changes, re-copy these files.
