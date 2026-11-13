import { ui } from "@/app/ui";
import { SHARE_LINK_GONE } from "@/server/share-links";

/** 分享連結 unknown, replaced (重新產生), closed or past its 12 hours. */
export default function ShareLinkGone() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
      <div style={ui.card}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>連結已失效</h1>
        <p style={{ ...ui.muted, margin: 0 }}>{SHARE_LINK_GONE}</p>
      </div>
    </main>
  );
}
