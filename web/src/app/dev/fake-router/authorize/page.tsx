import { notFound } from "next/navigation";
import { FAKE_TEACHERS, fakeApproveLogin, isProduction } from "@/server/router-gateway/fake";
import { ui } from "@/app/ui";

export const dynamic = "force-dynamic";

/**
 * Stand-in for the router's Authorization Page (`openid teacher`) while
 * ROUTER_GATEWAY=fake. Never served in production or with the real gateway.
 */
export default async function FakeAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.ROUTER_GATEWAY !== "fake" || isProduction(process.env)) notFound();
  const params = await searchParams;
  const redirectUri = params.redirect_uri;
  if (typeof redirectUri !== "string" || !URL.canParse(redirectUri)) notFound();
  if (new URL(redirectUri).pathname !== "/auth/callback") notFound();
  const authorizeUrl = `/dev/fake-router/authorize?${new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string"),
  )}`;

  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "96px 16px" }}>
      <div style={ui.card}>
        <p style={{ ...ui.muted, margin: "0 0 4px" }}>開發模式：假 router</p>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 16px" }}>選擇要登入的教師</h1>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {Object.values(FAKE_TEACHERS).map((t) => (
            <li key={t.userId}>
              <a
                href={fakeApproveLogin(authorizeUrl, t.userId)}
                style={{ ...ui.buttonOutline, display: "block", textDecoration: "none" }}
              >
                {t.displayName}
                <span style={{ ...ui.muted, fontSize: 12, marginLeft: 8 }}>
                  {t.isAdmin ? "管理員" : t.classes.length ? t.classes.map((c) => c.name).join("、") : "沒有班級"}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
