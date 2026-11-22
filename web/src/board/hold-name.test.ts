import { describe, expect, it } from "vitest";
import { holdNameError } from "./hold-name";

describe("holdNameError — 教師保留的名字", () => {
  it("accepts a blank name (shown as 「保留」) and a name up to 20 字", () => {
    expect(holdNameError("")).toBeNull();
    expect(holdNameError("   ")).toBeNull();
    expect(holdNameError("熱舞社")).toBeNull();
    expect(holdNameError("一二三四五六七八九十一二三四五六七八九十")).toBeNull();
  });

  it("rejects a name over 20 字, counted after trimming", () => {
    expect(holdNameError("一二三四五六七八九十一二三四五六七八九十一")).toBe("保留名字最多 20 字");
    expect(holdNameError("  一二三四五六七八九十一二三四五六七八九十  ")).toBeNull();
  });
});
