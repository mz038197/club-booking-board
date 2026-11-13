/** Display helpers for the live board (browser-safe). */

const ACTION_REQUESTS: Record<string, string> = {
  listSlots: "GET /slots",
  listMyBookings: "GET /bookings",
  bookSlot: "POST /bookings",
  cancelBooking: "DELETE /bookings/{id}",
  writePosterCopy: "POST /poster-copy",
};

const CODE_NOTES: Record<string, string> = {
  SLOT_TAKEN: "已被預約",
  INVALID_SLOT: "不在可借清單",
  LIMIT_REACHED: "已達每人上限",
  BOOKING_CLOSED: "目前不能預約",
  NOT_OWNER: "不是自己的預約",
  NOT_FOUND: "找不到預約",
  INVALID_REQUEST: "請求格式錯誤",
  INVALID_POSTER: "文案資料不完整",
  INTERNAL_ERROR: "伺服器錯誤",
};

export type Tone = "ok" | "quiet" | "warn" | "bad";

/** An API 呼叫紀錄 row as the class sees it: request line, tone, short note. */
export function describeCall(call: { action: string; status: number; code: string | null }): {
  request: string;
  tone: Tone;
  note: string | null;
} {
  const request = ACTION_REQUESTS[call.action] ?? call.action;
  const tone: Tone =
    call.status === 201
      ? "ok"
      : call.status < 300
        ? "quiet"
        : call.status === 409
          ? "warn"
          : "bad";
  return { request, tone, note: call.code ? (CODE_NOTES[call.code] ?? null) : null };
}

/** 12/16（三） for an ISO date. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = "日一二三四五六"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d}（${wd}）`;
}

const TIME = new Intl.DateTimeFormat("zh-Hant", {
  timeZone: "Asia/Taipei",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** HH:mm:ss in Taiwan time. */
export function clockTime(at: string | Date): string {
  return TIME.format(typeof at === "string" ? new Date(at) : at);
}

/** Time left until `expiresAt` (分享連結): 「剩 11 小時 58 分」, 「剩 5 分」, 「已過期」. */
export function remainingText(expiresAt: string | Date, now: Date): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return "已過期";
  const minutes = Math.ceil(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `剩 ${h} 小時 ${m} 分` : `剩 ${m} 分`;
}
