import { describe, expect, it } from "vitest";
import { cellDialogFor, holdNameError } from "./cell-dialog";
import type { BoardSlot } from "./types";

const slot = (over: Partial<BoardSlot>): BoardSlot => ({
  slot_id: "2026-12-16_13:10-15:00_301",
  date: "2026-12-16",
  start: "13:10",
  end: "15:00",
  room: "301",
  status: "open",
  ...over,
});

describe("cellDialogFor — 日展開的確認對話框", () => {
  it("asks for an optional name before 設保留 on an open 可借格", () => {
    expect(cellDialogFor(slot({}))).toEqual({
      action: "setHold",
      title: "保留 301 13:10–15:00",
      message: "學生與 Agent 會看到這一格已借。",
      nameField: { label: "學生看到的名字（選填）", placeholder: "保留" },
      confirmLabel: "設保留",
      danger: false,
    });
  });

  it("confirms 解除保留 on a held 可借格", () => {
    expect(cellDialogFor(slot({ status: "booked", booked_by: "熱舞社", held: true }))).toEqual({
      action: "releaseHold",
      title: "解除 301 13:10–15:00 的保留？",
      message: "學生就能預約這一格。",
      confirmLabel: "解除保留",
      danger: false,
    });
  });

  it("confirms 刪除海報 on a 預約 with a 海報, keeping the 預約", () => {
    const booked = slot({
      status: "booked",
      booked_by: "王小明",
      poster: { title: "熱舞社招生", body: "x" },
    });
    expect(cellDialogFor(booked)).toEqual({
      action: "deletePoster",
      title: "刪除 301 13:10–15:00 的海報？",
      message: "「熱舞社招生」會從看板撤下，預約會保留。",
      confirmLabel: "刪除海報",
      danger: true,
    });
  });

  it("has nothing for a 預約 without a 海報", () => {
    expect(cellDialogFor(slot({ status: "booked", booked_by: "王小明" }))).toBeNull();
  });
});

describe("holdNameError — 教師保留的名字", () => {
  it("accepts a blank name (shown as 「保留」) and a name up to 20 字", () => {
    expect(holdNameError("")).toBeNull();
    expect(holdNameError("   ")).toBeNull();
    expect(holdNameError("熱舞社")).toBeNull();
    expect(holdNameError("一二三四五六七八九十一二三四五六七八九十")).toBeNull();
  });

  it("rejects a name over 20 字, counted after trimming", () => {
    expect(holdNameError("一二三四五六七八九十一二三四五六七八九十一")).toBe("名字最多 20 字");
    expect(holdNameError("  一二三四五六七八九十一二三四五六七八九十  ")).toBeNull();
  });
});
