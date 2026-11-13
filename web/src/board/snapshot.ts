import type { BoardSlot } from "./types";

/**
 * JSON shapes the live board polls. The monitor endpoint sends a full
 * `MonitorSnapshot`; a read-only source (分享連結, #22) sends a `BoardSnapshot`
 * and the board hides the 名冊進度 and API 呼叫紀錄 panels.
 */

export type BoardSnapshot = {
  session: { id: string; name: string; paused?: boolean };
  slots: BoardSlot[];
  /** 名冊進度; omitted by sources that do not show it */
  roster?: MonitorRosterEntry[];
  /** API 呼叫紀錄, newest first; omitted by sources that do not show it */
  calls?: MonitorCall[];
};

export type MonitorRosterEntry = {
  student_id: number;
  display_name: string;
  first_call_at: string;
  /** First successful 預約 (kept after a cancel) */
  first_booked_at: string | null;
  /** 可借格 the student holds now */
  booked_count: number;
  /** 教室 of those 可借格, in booking order */
  rooms: string[];
};

export type MonitorCall = {
  id: number;
  at: string;
  student_id: number;
  display_name: string;
  /** OpenAPI operationId: listSlots, listMyBookings, bookSlot, cancelBooking, ... */
  action: string;
  slot_id: string | null;
  status: number;
  code: string | null;
  /** A successful bookSlot right after the same student's failed one (換格重試) */
  retry: boolean;
};

export type MonitorSnapshot = BoardSnapshot & {
  session: { id: string; name: string; class_id: number; paused: boolean };
  settings: { mask_names: boolean; auto_follow: boolean };
  roster: MonitorRosterEntry[];
  calls: MonitorCall[];
};
