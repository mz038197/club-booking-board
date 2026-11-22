-- #34: 拿掉時間窗. 預約規則 is only 每人上限 again (ADR 0004): when a student may
-- 預約／取消 is bounded by the 課堂金鑰's validity, and the teacher brakes with 暫停.
-- Existing 堂課 lose their 時間窗 here.
ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_booking_window_check,
  DROP COLUMN IF EXISTS booking_window_start,
  DROP COLUMN IF EXISTS booking_window_end;
