import { describe, expect, it } from "vitest";
import { maskDisplayName } from "./mask";

describe("maskDisplayName — 遮蔽顯示名稱", () => {
  it("hides the middle of a three-character name (王小明 → 王○明)", () => {
    expect(maskDisplayName("王小明")).toBe("王○明");
  });

  it("keeps a leading seat number and masks the name after it (07王小明 → 07王○明)", () => {
    expect(maskDisplayName("07王小明")).toBe("07王○明");
  });

  it("hides the second character of a two-character name", () => {
    expect(maskDisplayName("小明")).toBe("小○");
  });

  it("hides every middle character of a longer name", () => {
    expect(maskDisplayName("歐陽小明")).toBe("歐○○明");
    expect(maskDisplayName("Alice")).toBe("A○○○e");
  });

  it("leaves a one-character name and a bare seat number alone", () => {
    expect(maskDisplayName("明")).toBe("明");
    expect(maskDisplayName("07")).toBe("07");
  });

  it("trims surrounding spaces", () => {
    expect(maskDisplayName(" 王小明 ")).toBe("王○明");
  });
});
