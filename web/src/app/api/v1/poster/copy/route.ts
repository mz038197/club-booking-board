import { studentRoute } from "@/server/http/student-route";
import { parsePosterRequest, writePosterCopy } from "@/server/poster";

export const dynamic = "force-dynamic";

/** writePosterCopy: 依活動資料寫海報文案（標題、時間地點、slogan、內文），不出圖. */
export const POST = studentRoute("writePosterCopy", async ({ req }) => {
  const body: unknown = await req.json().catch(() => null);
  return Response.json(writePosterCopy(parsePosterRequest(body)));
});
