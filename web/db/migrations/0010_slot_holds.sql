-- v2 schema (#39, ADR 0006): 教師保留 — a teacher's setting on a 可借格 that makes it
-- 已借 for students and agents without being a 預約. At most one per 可借格; it goes
-- away with its 可借格 (移除單格, 整批覆寫) and survives 重置堂課.
-- name NULL = no name given (shown as 「保留」).
CREATE TABLE slot_holds (
  session_id uuid NOT NULL,
  slot_id    text NOT NULL,
  name       text CHECK (name IS NULL OR (name <> '' AND char_length(name) <= 20)),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (session_id, slot_id),
  FOREIGN KEY (session_id, slot_id) REFERENCES slots (session_id, slot_id) ON DELETE CASCADE
);

ALTER TABLE slot_holds ENABLE ROW LEVEL SECURITY;
