"use client";

import { useRouter } from "next/navigation";
import { LiveBoard } from "@/components/board/LiveBoard";

/**
 * The live board on the public share endpoint: no `controls`, no write actions.
 * When the link dies while open, re-render the page so it shows the 已失效 notice.
 */
export function ShareBoard({ token, title }: { token: string; title: string }) {
  const router = useRouter();
  return (
    <LiveBoard
      source={`/api/share/${encodeURIComponent(token)}`}
      title={title}
      onNotFound={() => router.refresh()}
    />
  );
}
