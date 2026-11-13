import { LOGIN_REQUIRED_NOTICE } from "@/server/http/teacher-auth";
import type { LoginError } from "@/app/login-paths";
import s from "./landing.module.css";

/**
 * The 首頁. Signed out: 「登入」 top right and in the hero, both going straight to
 * the router's login page (the only login page). Signed in: the teacher's 顯示名稱
 * and 「進入後台」. A failed login or a signed-out teacher page lands here with a banner.
 */
export type LandingProps = {
  /** The signed-in teacher's 顯示名稱, or null when signed out. */
  teacherName: string | null;
  error: LoginError | null;
  /** A teacher page was opened while signed out. */
  loginRequired: boolean;
};

const LOGIN_HREF = "/auth/login";
const ADMIN_HREF = "/admin";

const ERRORS: Record<LoginError, string> = {
  login_failed: "登入失敗，請再試一次。只有教師或管理員帳號可以登入後台。",
  router_unavailable: "身分驗證服務暫時無法使用，請稍後再試。",
};

export function Landing({ teacherName, error, loginRequired }: LandingProps) {
  return (
    <div className={s.page}>
      <header className={s.bar}>
        <div className={`${s.wrap} ${s.barInner}`}>
          <div className={s.barLeft}>
            <span className={s.logo}>
              <span aria-hidden className={s.logoMark}>VC</span>
              社團教室出借看板
            </span>
            <nav className={s.nav}>
              <a href="#how">運作方式</a>
              <a href="/api/v1/openapi.json">API 規格</a>
            </nav>
          </div>
          <div className={s.corner}>
            {teacherName ? (
              <>
                <span className={s.cornerName}>{teacherName}</span>
                <a href={ADMIN_HREF} className={s.btnLight}>進入後台</a>
              </>
            ) : (
              <a href={LOGIN_HREF} className={s.btnLight}>登入</a>
            )}
          </div>
        </div>
      </header>

      <Banner error={error} loginRequired={loginRequired && !teacherName} />

      <section className={s.hero}>
        <div className={s.wrap}>
          <p className={s.eyebrow}>Agent 課程實作</p>
          <h1 className={s.title}>
            讓你的 Agent
            <br />
            幫社團借教室
          </h1>
          <p className={s.lede}>學生用課堂金鑰呼叫 API 或 MCP 預約可借格，結果即時出現在投影看板上。</p>
          <div className={s.actions}>
            {teacherName ? (
              <a href={ADMIN_HREF} className={`${s.btnLight} ${s.btnLarge}`}>進入後台 →</a>
            ) : (
              <a href={LOGIN_HREF} className={`${s.btnLight} ${s.btnLarge}`}>用 VansCoding 帳號登入</a>
            )}
            <a href="#how" className={`${s.btnGhost} ${s.btnLarge}`}>學生怎麼開始</a>
          </div>
          {teacherName ? null : (
            <p className={s.loginHint}>教師登入會前往 VansCoding 登入頁，以 Google 帳號登入。</p>
          )}
        </div>
      </section>

      <section className={`${s.wrap} ${s.preview}`}>
        <div className={s.previewCard}>
          <div className={s.previewHead}>
            <span>投影看板預覽</span>
            <span>示範資料</span>
          </div>
          <DemoBoard />
        </div>
      </section>

      <section id="how" className={`${s.wrap} ${s.steps}`}>
        {STEPS.map((step, i) => (
          <div key={step.title}>
            <div className={s.stepNo}>0{i + 1}</div>
            <h3 className={s.stepTitle}>{step.title}</h3>
            <p className={s.stepBody}>{step.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function Banner({ error, loginRequired }: { error: LoginError | null; loginRequired: boolean }) {
  if (error) {
    return (
      <div role="alert" className={`${s.banner} ${s.bannerError}`}>
        {ERRORS[error]} <a href={LOGIN_HREF}>重新登入 →</a>
      </div>
    );
  }
  if (loginRequired) {
    return (
      <div role="status" className={s.banner}>
        {LOGIN_REQUIRED_NOTICE}。 <a href={LOGIN_HREF}>登入 →</a>
      </div>
    );
  }
  return null;
}

const STEPS = [
  { title: "取得課堂金鑰", body: "學生用課堂邀請碼登入 VansCoding，拿到自己的課堂金鑰。" },
  { title: "Agent 呼叫 API／MCP", body: "在 Agent Builder 接上 /api/v1 或 MCP server，查詢可借格並預約。" },
  { title: "看板即時顯示", body: "預約成功就出現在投影看板上；教師在後台監看、暫停、調整規則。" },
];

// 示範資料: 時段 × 教室, null = 可借, otherwise who booked it.
const DEMO_ROOMS = ["社辦 A", "社辦 B", "音樂教室", "美術教室"];
const DEMO_ROWS: { time: string; cells: (string | null)[] }[] = [
  { time: "12:10", cells: ["王小明", null, null, "陳同學"] },
  { time: "12:40", cells: [null, "林同學", null, null] },
  { time: "16:10", cells: [null, null, "吹奏社", null] },
  { time: "16:40", cells: ["張同學", null, null, null] },
  { time: "17:10", cells: [null, null, null, "熱舞社"] },
];

function DemoBoard() {
  return (
    <div className={s.scroll}>
      <table className={s.board}>
        <thead>
          <tr>
            <th className={s.time}>時段</th>
            {DEMO_ROOMS.map((room) => (
              <th key={room}>{room}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEMO_ROWS.map((row) => (
            <tr key={row.time}>
              <td className={s.time}>{row.time}</td>
              {row.cells.map((who, i) =>
                who ? (
                  <td key={i} className={s.booked} style={{ background: `var(--room-${i + 1})` }}>
                    {who}
                  </td>
                ) : (
                  <td key={i} className={s.free}>可借</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
