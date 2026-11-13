import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "社團教室出借看板",
  description: "學生經 Agent 預約社團可借教室，教師監看看板。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body
        style={{
          margin: 0,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Noto Sans TC', sans-serif",
          background: "#fafafa",
          color: "#09090b",
        }}
      >
        {children}
      </body>
    </html>
  );
}
