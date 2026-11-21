-- #35: 海報. One per 預約 (booking_id is the key, so 再貼 overwrites); it goes away
-- with its 預約 (學生取消、教師強制取消、重置堂課) through ON DELETE CASCADE.
-- 日期、時段、教室 are not stored: they always come from the 預約's 可借格.
CREATE TABLE posters (
  booking_id uuid PRIMARY KEY REFERENCES bookings (id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE posters ENABLE ROW LEVEL SECURITY;
