-- v2 schema (#20): 教師操作紀錄 — the admin actions a teacher took on a 堂課.

CREATE TABLE admin_actions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id   uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  at           timestamptz NOT NULL,
  teacher_id   integer NOT NULL,
  teacher_name text NOT NULL,
  action       text NOT NULL,
  message      text NOT NULL
);
CREATE INDEX admin_actions_session_idx ON admin_actions (session_id, at, id);
