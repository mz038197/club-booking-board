import { describe, expect, it } from "vitest";
import { remainingText } from "./format";

describe("remainingText — 分享連結剩餘時間", () => {
  const expires = "2026-12-16T15:00:00.000Z";

  it("shows hours and minutes", () => {
    expect(remainingText(expires, new Date("2026-12-16T03:00:00Z"))).toBe("剩 12 小時 0 分");
    expect(remainingText(expires, new Date("2026-12-16T13:30:00Z"))).toBe("剩 1 小時 30 分");
  });

  it("rounds a partial minute up and drops hours under one", () => {
    expect(remainingText(expires, new Date("2026-12-16T14:58:30Z"))).toBe("剩 2 分");
  });

  it("says 已過期 once expired", () => {
    expect(remainingText(expires, new Date("2026-12-16T15:00:00Z"))).toBe("已過期");
  });
});
