import { redirect } from "next/navigation";
import { HOME_PATH, loginErrorParam, loginErrorPath } from "@/auth/login-paths";

export const dynamic = "force-dynamic";

/** The old 教師後台登入 page, kept for bookmarks: login now starts from the 首頁. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const error = loginErrorParam((await searchParams).error);
  redirect(error ? loginErrorPath(error) : HOME_PATH);
}
