-- v2 schema, part 1: 堂課, 班級目前堂課, 可借格, plus the 學生 and 預約 tables
-- the board reads. Later tickets add new numbered files; never edit an
-- applied migration.
--
-- 班級 lives in the router; only class_id (router integer) is stored here.

-- 堂課
CREATE TABLE sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id          integer NOT NULL,
  name              text NOT NULL,
  paused            boolean NOT NULL DEFAULT false,
  per_student_limit integer NOT NULL DEFAULT 1 CHECK (per_student_limit BETWEEN 1 AND 5),
  mask_names        boolean NOT NULL DEFAULT false,
  auto_follow       boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_class_id_idx ON sessions (class_id, created_at);

-- 班級目前堂課: one row per class
CREATE TABLE class_current_sessions (
  class_id   integer PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE
);

-- 可借格: slot_id = {date}_{start}-{end}_{room}
CREATE TABLE slots (
  session_id uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  slot_id    text NOT NULL,
  date       text NOT NULL CHECK (date ~ '^\d{4}-\d{2}-\d{2}$'),
  start_time text NOT NULL CHECK (start_time ~ '^\d{2}:\d{2}$'),
  end_time   text NOT NULL CHECK (end_time ~ '^\d{2}:\d{2}$'),
  room       text NOT NULL CHECK (room <> ''),
  PRIMARY KEY (session_id, slot_id)
);

-- 學生: router student id -> latest 顯示名稱 (updated on each Key Check)
CREATE TABLE students (
  student_id   integer PRIMARY KEY,
  display_name text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 預約: one booking per 可借格, guaranteed by the unique constraint
CREATE TABLE bookings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  slot_id    text NOT NULL,
  student_id integer NOT NULL REFERENCES students (student_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, slot_id),
  FOREIGN KEY (session_id, slot_id) REFERENCES slots (session_id, slot_id)
);
CREATE INDEX bookings_student_idx ON bookings (session_id, student_id);
