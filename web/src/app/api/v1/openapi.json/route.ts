import { handle } from "@/server/http/errors";
import { studentOpenApi } from "@/server/openapi";
import { studentApiBaseUrl } from "@/server/public-urls";

export const dynamic = "force-dynamic";

/** 學生專用 OpenAPI (import into Agent Builder). Public: it holds no secrets. */
export const GET = handle(async (req: Request) => {
  const base = studentApiBaseUrl(process.env, new URL(req.url).origin);
  return Response.json(studentOpenApi(base));
});
