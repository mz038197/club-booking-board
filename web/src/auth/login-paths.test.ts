import { describe, expect, it } from "vitest";
import { LOGIN_REQUIRED_PATH, loginErrorParam, loginErrorPath, loginRequiredParam } from "./login-paths";

describe("首頁 login query params", () => {
  it("reads a known ?error= as itself and anything else as login_failed", () => {
    expect(loginErrorParam("router_unavailable")).toBe("router_unavailable");
    expect(loginErrorParam("login_failed")).toBe("login_failed");
    expect(loginErrorParam("<script>")).toBe("login_failed");
  });

  it("shows no error without ?error=", () => {
    expect(loginErrorParam(undefined)).toBeNull();
    expect(loginErrorParam("")).toBeNull();
    expect(loginErrorParam(["login_failed", "x"])).toBeNull();
  });

  it("round-trips the paths teacher pages redirect to", () => {
    const error = new URL(loginErrorPath("router_unavailable"), "http://x").searchParams.get("error");
    expect(loginErrorParam(error ?? undefined)).toBe("router_unavailable");

    const notice = new URL(LOGIN_REQUIRED_PATH, "http://x");
    expect(notice.pathname).toBe("/");
    expect(loginRequiredParam(notice.searchParams.get("notice") ?? undefined)).toBe(true);
    expect(loginRequiredParam(undefined)).toBe(false);
  });
});
