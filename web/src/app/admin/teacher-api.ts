"use client";

/** Calls the teacher API from admin client components; throws the server's `message` on failure. */
export async function teacherApi<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  // 401 (login expired) shows the server's 「請先登入教師後台」; reloading the page redirects to /login.
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `操作失敗（${res.status}）`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}
