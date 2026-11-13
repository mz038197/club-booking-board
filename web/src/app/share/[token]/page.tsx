import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDeps } from "@/server/deps";
import { sessionOfShareToken } from "@/server/share-links";
import { ShareBoard } from "./share-board";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "預約看板｜社團教室出借看板",
  // The token is in the URL: keep it out of search engines and Referer headers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * 學生分享連結 (ADR 0005): the read-only live 看板 of the link's 堂課, no login,
 * full 顯示名稱. Unknown / replaced / closed / expired links → 404 (./not-found.tsx).
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const deps = await getDeps();
  const session = await sessionOfShareToken(deps.db, token, deps.now());
  if (!session) notFound();
  return <ShareBoard token={token} title={session.name} />;
}
