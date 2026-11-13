export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>社團教室出借看板</h1>
      <p style={{ color: "var(--muted-fg)", margin: 0 }}>
        學生的 Agent 以課堂金鑰呼叫 <code>/api/v1</code> 查詢與預約可借格；教師後台與投影監看頁陸續上線。
      </p>
      <p style={{ margin: "16px 0 0" }}>
        <a href="/admin" style={{ color: "var(--foreground)" }}>
          教師後台 →
        </a>
      </p>
    </main>
  );
}
