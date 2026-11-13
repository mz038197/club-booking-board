-- v2 schema (#19): 預約規則's 時間窗 — the time of day (Asia/Taipei, HH:MM) on
-- the class day when students may 預約 and 取消. Both NULL = no 時間窗
-- (only the 課堂金鑰's validity applies). Start inclusive, end exclusive.
ALTER TABLE sessions
  ADD COLUMN booking_window_start text CHECK (booking_window_start ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  ADD COLUMN booking_window_end   text CHECK (booking_window_end ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  ADD CONSTRAINT sessions_booking_window_check CHECK (
    (booking_window_start IS NULL AND booking_window_end IS NULL)
    OR (booking_window_start IS NOT NULL AND booking_window_end IS NOT NULL
        AND booking_window_start < booking_window_end)
  );
