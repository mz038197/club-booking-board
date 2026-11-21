/** Board shapes shared by the 投影監看頁 and the 分享連結 page (browser-safe: no server imports). */

export type SlotStatus = "open" | "booked";

export type SlotSpec = {
  date: string;
  start: string;
  end: string;
  room: string;
};

/** A 海報 as a 看板 shows it; its 日期、時段、教室 are its 可借格's. */
export type BoardPoster = { title: string; body: string };

/**
 * One 可借格 of a 看板, as the API sends it; `booked_by` = 顯示名稱 (maybe masked);
 * `poster` only on teacher views, for a 預約 with a 海報.
 */
export type BoardSlot = SlotSpec & {
  slot_id: string;
  status: SlotStatus;
  booked_by?: string;
  /** 教師保留 (ADR 0006); only the teacher's monitor sends it — students see a plain 已借 */
  held?: true;
  poster?: BoardPoster;
};
