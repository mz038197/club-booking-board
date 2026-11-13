import { ui } from "@/app/ui";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  login_failed: "登入失敗，請再試一次。只有教師或管理員帳號可以登入後台。",
  router_unavailable: "身分驗證服務暫時無法使用，請稍後再試。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const error = (await searchParams).error;
  const message = typeof error === "string" ? (ERRORS[error] ?? ERRORS.login_failed) : null;
  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "96px 16px" }}>
      <div style={ui.card}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 4px" }}>教師後台登入</h1>
        <p style={{ ...ui.muted, margin: "0 0 20px" }}>
          以 Google 經 router 登入。後台只取得你的身分，不會取得任何金鑰。
        </p>
        {message ? (
          <p role="alert" style={ui.alert}>
            {message}
          </p>
        ) : null}
        {/* A plain link: /auth/login answers with a redirect to the router. */}
        <a href="/auth/login" style={{ ...ui.buttonPrimary, display: "block", textAlign: "center" }}>
          用 Google 登入
        </a>
      </div>
    </main>
  );
}
