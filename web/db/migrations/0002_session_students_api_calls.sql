-- v2 schema, part 2 (#16): 堂課學生 (名冊) and the API 呼叫紀錄.

-- 堂課學生: a student who has called at least once in this 堂課.
CREATE TABLE session_students (
  session_id      uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  student_id      integer NOT NULL REFERENCES students (student_id),
  first_call_at   timestamptz NOT NULL,
  first_booked_at timestamptz,
  PRIMARY KEY (session_id, student_id)
);
CREATE INDEX session_students_first_call_idx ON session_students (session_id, first_call_at);

-- API 呼叫紀錄: every student call (failures too) once the 目前堂課 is known.
CREATE TABLE api_calls (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id  uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  at          timestamptz NOT NULL,
  student_id  integer NOT NULL REFERENCES students (student_id),
  action      text NOT NULL,
  slot_id     text,
  http_status integer NOT NULL,
  code        text
);
CREATE INDEX api_calls_session_idx ON api_calls (session_id, at, id);
