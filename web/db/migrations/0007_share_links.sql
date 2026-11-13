-- v2 schema (#22, ADR 0005): 學生分享連結. At most one live link per 堂課
-- (regenerating replaces the row, so the old token stops working at once).
-- Only the SHA-256 of the token is stored, never the token itself.
CREATE TABLE share_links (
  session_id uuid PRIMARY KEY REFERENCES sessions (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
