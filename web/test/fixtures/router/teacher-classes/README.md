Proposed contract for the router's class lookup (router ADR 0094: "A Partner Service with its
Service Credential may ask which Classes a user may manage, answered the way the Key Check answers
a Personal API Key (`classes`)"). The router has not built it yet; this is what the gateway sends
and accepts until it does. Replace these files with the router's `docs/contracts/` copies once they exist.

Request: `POST {ROUTER_URL}/internal/teacher-classes`
  headers `Authorization: Bearer <Service Credential>`, `Content-Type: application/json`
  body `{"user_id": 42}`

200 answers:
- `accepted.json` — the user may manage these Classes (`is_admin: true` = every Class).
- `refused.json` — the user is unknown or no longer a teacher/admin: treated as no Classes.

Anything else (non-200, unreadable body, timeout over 3 s) → unavailable.
