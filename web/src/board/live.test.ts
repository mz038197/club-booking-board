import { describe, expect, it } from "vitest";
import { newlyBooked } from "./live";
import type { BoardSlot } from "./types";

const open = (slot_id: string, date = "2026-12-16"): BoardSlot => ({
  slot_id,
  date,
  start: "12:10",
  end: "13:00",
  room: slot_id,
  status: "open",
});
const booked = (slot_id: string, by: string, date = "2026-12-16"): BoardSlot => ({
  ...open(slot_id, date),
  status: "booked",
  booked_by: by,
});

describe("newlyBooked — 預約成功通知", () => {
  it("reports nothing on the first poll (no earlier snapshot)", () => {
    expect(newlyBooked(null, [booked("301", "王○明")])).toEqual([]);
  });

  it("reports a 可借格 that went from 可借 to 已借 since the last poll", () => {
    const prev = [open("301"), open("302")];
    const next = [open("301"), booked("302", "李○華", "2026-12-17")];

    expect(newlyBooked(prev, next)).toEqual([booked("302", "李○華", "2026-12-17")]);
  });

  it("ignores 可借格 that stayed 已借 or were cancelled", () => {
    const prev = [booked("301", "王○明"), booked("302", "李○華")];
    const next = [booked("301", "王○明"), open("302")];

    expect(newlyBooked(prev, next)).toEqual([]);
  });

  it("reports a 可借格 re-booked by someone else between polls", () => {
    const prev = [booked("301", "王○明")];
    const next = [booked("301", "李○華")];

    expect(newlyBooked(prev, next)).toEqual([booked("301", "李○華")]);
  });

  it("reports a 可借格 that was added and booked between polls", () => {
    expect(newlyBooked([], [booked("303", "陳○文")])).toEqual([booked("303", "陳○文")]);
  });
});
